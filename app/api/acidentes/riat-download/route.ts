export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { auth } from '@clerk/nextjs/server';
import { getRiatCellMap, RIAT_CAT_CELL } from '@/lib/acidentes/riatCellMap';
import { buildRiatCellValues, toDDMMYYYY } from '@/lib/acidentes/riatValues';
import { fillRiatTemplateFromFile } from '@/lib/acidentes/fillRiatTemplate';

/** Única fonte: o arquivo versionado no repositório (public/templates/riat.xlsx). Sem fallback, sem modelo genérico. */
function resolveTemplatePath(): string | null {
  const full = path.join(process.cwd(), 'public', 'templates', 'riat.xlsx');
  return fs.existsSync(full) ? full : null;
}

/**
 * POST — body: { acidente, observacoes?, numeroSinan?, riatOverrides? }
 * Usa ExcelJS: copia o .xlsx oficial e só altera valores (preserva layout, mesclas e formatação).
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
            'Arquivo RIAT não encontrado: é obrigatório public/templates/riat.xlsx no repositório (o mesmo do GitHub). Faça commit e redeploy.',
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
