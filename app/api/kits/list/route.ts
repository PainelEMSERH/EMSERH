import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const rows = await prisma.kit.findMany({
      orderBy: { nome: "asc" },
      include: { kitItem: { select: { item: true, quantidade: true } } }
    });
    const mapped = rows.map((r:any)=>({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao,
      itens: (r.kitItem||[]).map((ki:any)=>({ item: ki.item, quantidade: Number(ki.quantidade||0) }))
    }));
    return NextResponse.json({ ok: true, rows: mapped });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: String(e?.message||e) }, { status: 500 });
  }
}
