export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { auth } from '@clerk/nextjs/server';
import { getRiatCellMap, RIAT_CAT_CELL } from '@/lib/acidentes/riatCellMap';
import { buildRiatCellValues, toDDMMYYYY } from '@/lib/acidentes/riatValues';
import { fillRiatTemplateFromFile } from '@/lib/acidentes/fillRiatTemplate';

function resolveTemplatePath(): string | null {
  const base = path.join(process.cwd(), 'public', 'templates');
  const candidates = ['riat-emserh.xlsx', 'riat.xlsx'];
  for (const name of candidates) {
    const full = path.join(base, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/**
 * POST — body: { acidente, observacoes?, numeroSinan?, riatOverrides? }
 * Preenche apenas o modelo oficial em public/templates/riat-emserh.xlsx ou riat.xlsx (ExcelJS).
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const acidente = body.acidente || {};
    const observacoes = body.observacoes ?? '';
    const numeroSinan = body.numeroSinan ?? '';
    const riatOverrides =
      body.riatOverrides && typeof body.riatOverrides === 'object' ? (body.riatOverrides as Record<string, string>) : {};

    const templatePath = resolveTemplatePath();
    if (!templatePath) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Modelo RIAT não encontrado. Coloque riat-emserh.xlsx ou riat.xlsx em public/templates/.',
        },
        { status: 400 }
      );
    }

    const cellMap = getRiatCellMap();
    const values = buildRiatCellValues(acidente, String(observacoes), String(numeroSinan), riatOverrides);
    const numeroCAT = String(acidente.numeroCAT ?? '');

    const outBuf = await fillRiatTemplateFromFile(templatePath, cellMap, values, RIAT_CAT_CELL, numeroCAT);

    const safeNome = (acidente.nome || 'acidente').replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '').trim().slice(0, 40) || 'RIAT';
    const dataStr = toDDMMYYYY(acidente.data as string | undefined).replace(/\//g, '-');
    const filename = `RIAT_${safeNome}_${dataStr}.xlsx`;

    return new NextResponse(outBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error('[acidentes/riat-download]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
