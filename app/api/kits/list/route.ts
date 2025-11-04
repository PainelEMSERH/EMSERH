import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Try to read from normalized tables if they exist; otherwise return []
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT k.id, k.nome, k.descricao,
             COALESCE(json_agg(json_build_object('item', i.nome, 'quantidade', ki.quantidade)
              ORDER BY i.nome) FILTER (WHERE i.id IS NOT NULL), '[]') AS composicao
      FROM kit k
      LEFT JOIN kit_item ki ON ki.kit_id = k.id
      LEFT JOIN item i ON i.id = ki.item_id
      GROUP BY k.id, k.nome, k.descricao
      ORDER BY k.nome ASC
    `);
    return NextResponse.json({ ok: true, data: rows });
  } catch (err:any) {
    return NextResponse.json({ ok:false, error: String(err?.message || err) }, { status: 500 });
  }
}