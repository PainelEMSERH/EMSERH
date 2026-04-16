import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Evita erro "Do not know how to serialize a BigInt" no JSON
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) out[k] = convertBigIntToNumber(v);
    return out;
  }
  return obj;
}

/**
 * Rota de debug para verificar dados do SPCI
 */
export async function GET(req: Request) {
  try {
    // Se vier TAG na querystring, retorna o registro completo (ajuda a validar importação)
    // Ex.: /api/spci/debug?tag=AGTR-BCOR-SESMT-001
    // (mantém "debug" fora do frontend normal; é só inspeção)
    const url = new URL(req.url);
    const tag = (url.searchParams.get('tag') || '').trim();

    if (tag) {
      const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'spci_planilha'
        `,
      );
      const has = new Set(cols.map((c) => String(c.column_name)));
      const baseCols = [
        'id',
        'TAG',
        'Unidade',
        'Regional',
        'Local',
        'Última recarga',
        'Planej. Recarga',
        'Data Execução Recarga',
        'Mês Planej Recarga',
        'Mês Exec Recarga',
        '_import_batch_id',
        '_imported_at',
      ];
      const selectCols = baseCols
        .filter((c) => (c === 'id' ? has.has('id') : has.has(c)))
        .map((c) => {
          if (c === 'id') return 'id';
          if (c === '_import_batch_id') return `"${c}"::text AS "${c}"`;
          if (c === '_imported_at') return `"${c}"::text AS "${c}"`;
          return `"${c}"`;
        });

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          ${selectCols.join(',\n          ')}
        FROM spci_planilha
        WHERE TRIM("TAG") = $1
        ORDER BY id DESC
        LIMIT 5
        `,
        tag,
      );
      return NextResponse.json({ ok: true, tag, rows: convertBigIntToNumber(rows) });
    }

    // Conta total de registros
    const countResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int AS total FROM spci_planilha`
    );
    const total = countResult?.[0]?.total ?? 0;

    // Busca algumas amostras
    const samples = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "TAG", "Unidade", "Regional", "Última recarga" 
       FROM spci_planilha 
       LIMIT 10`
    );

    // Busca unidades únicas
    const unidadesRes = await prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT "Unidade" FROM spci_planilha 
       WHERE "Unidade" IS NOT NULL AND "Unidade" != '' 
       ORDER BY "Unidade" 
       LIMIT 20`
    );
    const unidades = unidadesRes.map((u: any) => u.Unidade || u['Unidade'] || u).filter(Boolean);

    // Busca regionais únicas
    const regionaisRes = await prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT "Regional" FROM spci_planilha 
       WHERE "Regional" IS NOT NULL AND "Regional" != '' 
       ORDER BY "Regional"`
    );
    const regionais = regionaisRes.map((r: any) => r.Regional || r['Regional'] || r).filter(Boolean);

    return NextResponse.json({
      ok: true,
      total,
      samples: convertBigIntToNumber(samples),
      unidades,
      regionais,
      message: 'Debug info do SPCI',
    });
  } catch (error: any) {
    console.error('spci/debug error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error?.message || 'Erro ao buscar dados',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
