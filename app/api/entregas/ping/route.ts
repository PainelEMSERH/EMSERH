import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS entrega_epi (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cpf text NOT NULL,
        nome text NOT NULL,
        funcao text,
        regional text,
        unidade text,
        item text NOT NULL,
        quantidade int NOT NULL,
        data_entrega timestamptz NOT NULL DEFAULT now(),
        entregue_por text,
        obs text
      );
    `);
    const counts = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM stg_alterdata) AS stg_alterdata,
        (SELECT COUNT(*)::int FROM stg_unid_reg) AS stg_unid_reg,
        (SELECT COUNT(*)::int FROM stg_epi_map) AS stg_epi_map,
        (SELECT COUNT(*)::int FROM entrega_epi) AS entrega_epi
    `);
    return NextResponse.json({ ok: true, counts: counts?.[0] || {} });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
