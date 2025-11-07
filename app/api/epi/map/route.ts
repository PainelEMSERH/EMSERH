import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function trySelect(sql: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(sql);
    return rows;
  } catch (_e) {
    return null;
  }
}

export async function GET() {
  try {
    // Tentativas de ler a base oficial (stg_epi_map) com nomes comuns de colunas
    const attempts = [
      `select funcao, epi, quantidade from stg_epi_map`,
      `select funcao, epi, qtd as quantidade from stg_epi_map`,
      `select funcao, item as epi, qtd as quantidade from stg_epi_map`,
      `select funcao, item as epi, quantidade from stg_epi_map`,
      `select funcao, "EPI" as epi, "Quantidade" as quantidade from stg_epi_map`,
    ];
    let mapped: any[] | null = null;
    for (const sql of attempts) {
      const r = await trySelect(sql);
      if (r && r.length !== undefined) { mapped = r; break; }
    }
    if (!mapped) {
      return NextResponse.json({ ok: false, error: "stg_epi_map não encontrada ou colunas incompatíveis" }, { status: 200 });
    }
    // Normaliza
    const rows = mapped.map((r: any) => ({
      funcao: String(r.funcao ?? "").trim(),
      epi: String(r.epi ?? "").trim(),
      quantidade: Number(r.quantidade ?? 1) || 1,
    })).filter(x => x.funcao && x.epi);

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
