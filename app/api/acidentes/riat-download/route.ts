export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { auth } from '@clerk/nextjs/server';

const TEMPLATE = path.join(process.cwd(), 'public', 'templates', 'riat.xlsx');

/**
 * POST — devolve o arquivo public/templates/riat.xlsx exatamente como está no GitHub,
 * sem preencher células (cópia byte a byte).
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    await req.json().catch(() => ({}));

    if (!fs.existsSync(TEMPLATE)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Arquivo RIAT não encontrado: é obrigatório public/templates/riat.xlsx no repositório (o mesmo do GitHub). Faça commit e redeploy.',
        },
        { status: 400 }
      );
    }

    const buf = fs.readFileSync(TEMPLATE);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="riat.xlsx"',
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
