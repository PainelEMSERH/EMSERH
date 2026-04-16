import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          id,
          "TAG",
          "Unidade",
          "Regional",
          "Local",
          "Última recarga",
          "Planej. Recarga",
          "Data Execução Recarga",
          "Mês Planej Recarga",
          "Mês Exec Recarga",
          "_import_batch_id"::text AS _import_batch_id,
          "_imported_at"::text AS _imported_at
        FROM spci_planilha
        WHERE TRIM("TAG") = $1
        ORDER BY "_imported_at" DESC NULLS LAST, id DESC
        LIMIT 5
        `,
        tag,
      );
      return NextResponse.json({ ok: true, tag, rows });
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
      samples,
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
