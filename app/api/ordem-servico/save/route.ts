import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * API para salvar confirmação de entrega de Ordem de Serviço
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { colaboradorCpf, entregue, dataEntrega, responsavel, termoRecusa } = body;

    if (!colaboradorCpf) {
      return NextResponse.json(
        { ok: false, error: 'CPF do colaborador é obrigatório' },
        { status: 400 }
      );
    }

    // Cria tabela se não existir
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ordem_servico (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        colaborador_cpf TEXT NOT NULL,
        entregue BOOLEAN NOT NULL DEFAULT false,
        data_entrega DATE,
        responsavel TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(colaborador_cpf)
      );
    `);

    // Cria índices se não existirem
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_colaborador_cpf ON ordem_servico(colaborador_cpf);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_data_entrega ON ordem_servico(data_entrega);
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS termo_recusa BOOLEAN NOT NULL DEFAULT false;
    `);

    const dataEntregaDate = dataEntrega ? new Date(dataEntrega) : null;
    if (dataEntregaDate && isNaN(dataEntregaDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'Data de entrega inválida' },
        { status: 400 }
      );
    }

    // Insere ou atualiza
    // Forçamos o cast explícito de $3 para DATE para evitar o erro:
    // "column \"data_entrega\" is of type date but expression is of type text"
    const entregueBool = entregue === true || entregue === 'true';
    const termoRecusaBool = entregueBool && (termoRecusa === true || termoRecusa === 'true');

    const query = `
      INSERT INTO ordem_servico (colaborador_cpf, entregue, data_entrega, responsavel, termo_recusa, updated_at)
      VALUES ($1, $2, $3::date, $4, $5, NOW())
      ON CONFLICT (colaborador_cpf) 
      DO UPDATE SET
        entregue = EXCLUDED.entregue,
        data_entrega = EXCLUDED.data_entrega,
        responsavel = EXCLUDED.responsavel,
        termo_recusa = EXCLUDED.termo_recusa,
        updated_at = NOW()
      RETURNING id, colaborador_cpf, entregue, data_entrega::text as data_entrega, responsavel, termo_recusa
    `;

    const result: any[] = await prisma.$queryRawUnsafe(
      query,
      colaboradorCpf,
      entregueBool,
      dataEntregaDate ? dataEntregaDate.toISOString().split('T')[0] : null,
      responsavel || null,
      termoRecusaBool
    );

    return NextResponse.json({
      ok: true,
      data: result[0],
    });
  } catch (e: any) {
    console.error('[ordem-servico/save] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
