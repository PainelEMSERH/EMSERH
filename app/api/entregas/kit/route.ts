export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const funcao = searchParams.get("funcao") ?? "";
  if (!funcao) return NextResponse.json({ ok: false, error: "funcao inválida" }, { status: 400 });

  try {
    const sql = `
      SELECT epi_item AS item,
             COALESCE(quantidade, 0)::float AS quantidade,
             COALESCE(nome_site, epi_item) AS nome_site
      FROM stg_epi_map
      WHERE alterdata_funcao = $1
      ORDER BY nome_site, epi_item
    `;
    // @ts-ignore
    const rows: any[] = await prisma.$queryRawUnsafe(sql, funcao);
    return NextResponse.json({ ok: true, items: rows });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e?.message || "erro" }, { status: 500 });
  }
}
