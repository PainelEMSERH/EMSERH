import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SITUACAO_ABANDONO_EMPREGO } from '@/lib/ordem-servico-sql';

/**
 * API para salvar confirmação de entrega de Ordem de Serviço, termo de recusa ou abandono de emprego.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { colaboradorCpf, entregue, dataEntrega, responsavel, termoRecusa, situacaoColaborador } = body;

    if (!colaboradorCpf) {
      return NextResponse.json(
        { ok: false, error: 'CPF do colaborador é obrigatório' },
        { status: 400 }
      );
    }

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

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_colaborador_cpf ON ordem_servico(colaborador_cpf);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_data_entrega ON ordem_servico(data_entrega);
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS termo_recusa BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS situacao_colaborador TEXT;
    `);

    const rawSit = situacaoColaborador;
    const isAbandono =
      typeof rawSit === 'string' && rawSit.trim().toLowerCase() === SITUACAO_ABANDONO_EMPREGO.toLowerCase();

    let entregueBool = entregue === true || entregue === 'true';
    let termoRecusaBool = entregueBool && (termoRecusa === true || termoRecusa === 'true');
    let dataEntregaDate: Date | null = dataEntrega ? new Date(dataEntrega) : null;
    let situacaoVal: string | null = null;

    if (isAbandono) {
      entregueBool = false;
      termoRecusaBool = false;
      dataEntregaDate = null;
      situacaoVal = SITUACAO_ABANDONO_EMPREGO;
    } else {
      situacaoVal = null;
    }

    if (!isAbandono && dataEntregaDate && isNaN(dataEntregaDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'Data de entrega inválida' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO ordem_servico (colaborador_cpf, entregue, data_entrega, responsavel, termo_recusa, situacao_colaborador, updated_at)
      VALUES ($1, $2, $3::date, $4, $5, $6, NOW())
      ON CONFLICT (colaborador_cpf) 
      DO UPDATE SET
        entregue = EXCLUDED.entregue,
        data_entrega = EXCLUDED.data_entrega,
        responsavel = EXCLUDED.responsavel,
        termo_recusa = EXCLUDED.termo_recusa,
        situacao_colaborador = EXCLUDED.situacao_colaborador,
        updated_at = NOW()
      RETURNING id, colaborador_cpf, entregue, data_entrega::text as data_entrega, responsavel, termo_recusa, situacao_colaborador
    `;

    const result: any[] = await prisma.$queryRawUnsafe(
      query,
      colaboradorCpf,
      entregueBool,
      dataEntregaDate ? dataEntregaDate.toISOString().split('T')[0] : null,
      responsavel || null,
      termoRecusaBool,
      situacaoVal
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
