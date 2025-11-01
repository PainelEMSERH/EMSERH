import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Raw SQL to avoid Prisma type issues. Adjust identifiers if your schema uses different column names.
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        k.id,
        k.nome,
        COALESCE(k.descricao, '') AS descricao,
        json_agg(json_build_object('item', i.nome, 'quantidade', COALESCE(ki.quantidade, 0)))
          FILTER (WHERE i.id IS NOT NULL) AS composicao
      FROM kit k
      LEFT JOIN kit_item ki ON ki.kit_id = k.id
      LEFT JOIN item i ON i.id = ki.item_id
      GROUP BY k.id, k.nome, k.descricao
      ORDER BY k.nome ASC;
    `);

    const data = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao,
      composicao: Array.isArray(r.composicao)
        ? r.composicao.map((c: any) => `${c.item} (${c.quantidade})`).join(", ")
        : "",
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("KITS_LIST_ERROR", err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
