import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const colab = body?.colaborador;
    const itens = Array.isArray(body?.itens) ? body.itens : [];
    const obs = (body?.obs ?? "") as string;

    if (!colab?.cpf) return NextResponse.json({ ok:false, error:"colaborador inválido" }, { status:400 });

    // Tabelas mínimas (criadas sob demanda) — sem migrations
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS entrega (
        id TEXT PRIMARY KEY,
        data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        regional TEXT,
        unidade TEXT,
        colaborador_cpf TEXT,
        colaborador_nome TEXT,
        funcao TEXT,
        responsavel_user_id TEXT,
        observacao TEXT
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS entrega_item (
        id TEXT PRIMARY KEY,
        entrega_id TEXT,
        item TEXT,
        nome_site TEXT,
        qtd_solicitada NUMERIC,
        qtd_entregue NUMERIC,
        qtd_pendente NUMERIC
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS pendencia (
        id TEXT PRIMARY KEY,
        entrega_id TEXT,
        colaborador_cpf TEXT,
        item TEXT,
        quantidade NUMERIC,
        status TEXT,
        aberta_em TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const entregaId = crypto.randomUUID();

    await prisma.$executeRawUnsafe(`
      INSERT INTO entrega (id, regional, unidade, colaborador_cpf, colaborador_nome, funcao, responsavel_user_id, observacao)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, entregaId, colab.regional, colab.unidade_hospitalar, colab.cpf, colab.colaborador, colab.funcao, "", obs);

    for (const it of itens) {
      const qtdS = Number(it.qtdSolicitada ?? 0);
      const qtdE = Number(it.qtdEntregue ?? 0);
      const qtdP = Math.max(0, qtdS - qtdE);
      await prisma.$executeRawUnsafe(`
        INSERT INTO entrega_item (id, entrega_id, item, nome_site, qtd_solicitada, qtd_entregue, qtd_pendente)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, crypto.randomUUID(), entregaId, String(it.item), String(it.nome_site ?? it.item), qtdS, qtdE, qtdP);

      if (qtdP > 0) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO pendencia (id, entrega_id, colaborador_cpf, item, quantidade, status)
          VALUES ($1, $2, $3, $4, $5, 'aberta')
        `, crypto.randomUUID(), entregaId, colab.cpf, String(it.item), qtdP);
      }
    }

    return NextResponse.json({ ok:true, entregaId });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || "erro" }, { status:500 });
  }
}
