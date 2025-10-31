// app/api/kits/delete/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id: string | undefined = body?.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    // Prisma usa camelCase para os modelos: KitItem e Kit -> prisma.kitItem / prisma.kit
    await prisma.kitItem.deleteMany({ where: { kitId: id } } as any);
    await prisma.kit.delete({ where: { id } } as any);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Erro ao excluir kit" },
      { status: 500 }
    );
  }
}
