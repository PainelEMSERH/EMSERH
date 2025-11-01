import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/entregas/registrar  { cpf, nome, funcao, regional, unidade, item, quantidade, year }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      cpf,
      nome,
      funcao,
      regional,
      unidade,
      item,
      quantidade,
      year,
      obs,
      user,
    } = body || {};

    if (!cpf || !item) {
      return NextResponse.json({ ok: false, error: "cpf e item são obrigatórios." }, { status: 400 });
    }

    // garante tabela
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
    // índice único por ano
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_entrega_unique
      ON entrega_epi (cpf, item, date_part('year', data_entrega));
    `);

    // insere (usa upsert via ON CONFLICT para o mesmo ano)
    const insertSql = `
      INSERT INTO entrega_epi (cpf, nome, funcao, regional, unidade, item, quantidade, data_entrega, entregue_por, obs)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
      ON CONFLICT (cpf, item, date_part('year', data_entrega)) DO UPDATE
        SET quantidade = EXCLUDED.quantidade,
            data_entrega = NOW(),
            entregue_por = EXCLUDED.entregue_por,
            obs = EXCLUDED.obs
      RETURNING id
    `;
    const result: any = await prisma.$queryRawUnsafe(insertSql,
      String(cpf), String(nome || ""), String(funcao || null),
      String(regional || null), String(unidade || null), String(item),
      parseInt(String(quantidade || 1), 10),
      String(user || "sistema"), String(obs || null)
    );

    return NextResponse.json({ ok: true, id: result?.[0]?.id || null });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
