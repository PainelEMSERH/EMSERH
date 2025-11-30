
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type KitRow = { item: string; quantidade: number; nome_site: string | null };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const funcaoRaw = (searchParams.get('funcao') || '').trim();
  const unidadeRaw = (searchParams.get('unidade') || '').trim();

  if (!funcaoRaw) {
    return NextResponse.json(
      { ok: false, error: 'função inválida' },
      { status: 400 },
    );
  }

  try {
    const params: any[] = [funcaoRaw];
    let whereUnid = '';

    if (unidadeRaw) {
      params.push(unidadeRaw);
      whereUnid = `
        AND (
          trim(coalesce(m.nome_site,'')) = ''
          OR UPPER(REGEXP_REPLACE(m.nome_site,'[^A-Z0-9]+','','g')) = UPPER(REGEXP_REPLACE($2,'[^A-Z0-9]+','','g'))
        )
      `;
    }

    const sql = `
      SELECT
        TRIM(m.epi_item) AS item,
        GREATEST(1, ROUND(COALESCE(m.quantidade,1)))::int AS quantidade,
        NULLIF(TRIM(m.nome_site),'') AS nome_site
      FROM stg_epi_map m
      WHERE UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g'))
            = UPPER(REGEXP_REPLACE($1,'[^A-Z0-9]+','','g'))
      ${whereUnid}
      GROUP BY TRIM(m.epi_item), NULLIF(TRIM(m.nome_site),'')
      ORDER BY TRIM(m.epi_item);
    `;

    const rows: any[] = await prisma.$queryRawUnsafe(sql, ...params);

    const items: KitRow[] = rows.map((r: any) => ({
      item: String(r.item || ''),
      quantidade: Number(r.quantidade || 1) || 1,
      nome_site: r.nome_site ? String(r.nome_site) : null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error('Error in /api/entregas/kit', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'erro' },
      { status: 500 },
    );
  }
}
