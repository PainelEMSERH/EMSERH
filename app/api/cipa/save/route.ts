import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * API para atualizar data de conclusão de uma atividade CIPA
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { regional, unidade, ano_gestao, atividade_codigo, data_conclusao } = body;

    if (!regional || !unidade || !ano_gestao || !atividade_codigo) {
      return NextResponse.json(
        { ok: false, error: 'Regional, unidade, ano e código da atividade são obrigatórios' },
        { status: 400 }
      );
    }

    // Converte data de DD/MM/YYYY ou YYYY-MM-DD para DATE
    let dataConclusaoDate: string | null = null;
    if (data_conclusao && String(data_conclusao).trim()) {
      const dtStr = String(data_conclusao).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dtStr)) {
        dataConclusaoDate = dtStr;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dtStr)) {
        const [dd, mm, yyyy] = dtStr.split('/');
        dataConclusaoDate = `${yyyy}-${mm}-${dd}`;
      } else {
        return NextResponse.json(
          { ok: false, error: 'Formato de data inválido. Use DD/MM/YYYY ou YYYY-MM-DD' },
          { status: 400 }
        );
      }
    }

    // IMPORTANTE:
    // Como usamos parâmetros ($1, $2, ...), NÃO devemos "escapar" manualmente apóstrofos,
    // senão nomes como "OLHO D'ÁGUA" viram "OLHO D''ÁGUA" e o UPDATE não encontra a linha.
    const regParam = String(regional).trim();
    const uniParam = String(unidade).trim();
    const anoNum = parseInt(String(ano_gestao), 10);
    const codNum = parseInt(String(atividade_codigo), 10);

    if (isNaN(anoNum) || isNaN(codNum)) {
      return NextResponse.json(
        { ok: false, error: 'Ano e código da atividade devem ser números' },
        { status: 400 }
      );
    }

    // Atualiza registro existente.
    // Observação: a tabela `cronograma_cipa` no Neon não tem `updated_at`, então não devemos setar esse campo.
    if (dataConclusaoDate) {
      await prisma.$executeRawUnsafe(
        `
          UPDATE cronograma_cipa
          SET data_conclusao = $1::date
          WHERE UPPER(TRIM(regional)) = UPPER(TRIM($2))
            AND UPPER(TRIM(unidade)) = UPPER(TRIM($3))
            AND ano_gestao = $4
            AND atividade_codigo = $5
        `,
        dataConclusaoDate,
        regParam,
        uniParam,
        anoNum,
        codNum,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
          UPDATE cronograma_cipa
          SET data_conclusao = NULL
          WHERE UPPER(TRIM(regional)) = UPPER(TRIM($1))
            AND UPPER(TRIM(unidade)) = UPPER(TRIM($2))
            AND ano_gestao = $3
            AND atividade_codigo = $4
        `,
        regParam,
        uniParam,
        anoNum,
        codNum,
      );
    }

    // Retorna o registro atualizado
    const result: any[] = await prisma.$queryRawUnsafe(
      `
        SELECT id, regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
               data_inicio_prevista::text AS data_inicio_prevista,
               data_fim_prevista::text AS data_fim_prevista,
               data_conclusao::text AS data_conclusao,
               data_posse_gestao::text AS data_posse_gestao
        FROM cronograma_cipa
        WHERE UPPER(TRIM(regional)) = UPPER(TRIM($1))
          AND UPPER(TRIM(unidade)) = UPPER(TRIM($2))
          AND ano_gestao = $3
          AND atividade_codigo = $4
        LIMIT 1
      `,
      regParam,
      uniParam,
      anoNum,
      codNum,
    );

    return NextResponse.json({
      ok: true,
      row: result[0] ? {
        id: result[0].id,
        regional: String(result[0].regional ?? ''),
        unidade: String(result[0].unidade ?? ''),
        ano_gestao: Number(result[0].ano_gestao) || 0,
        atividade_codigo: Number(result[0].atividade_codigo) || 0,
        atividade_nome: String(result[0].atividade_nome ?? ''),
        data_inicio_prevista: result[0].data_inicio_prevista ? String(result[0].data_inicio_prevista).slice(0, 10) : null,
        data_fim_prevista: result[0].data_fim_prevista ? String(result[0].data_fim_prevista).slice(0, 10) : null,
        data_conclusao: result[0].data_conclusao ? String(result[0].data_conclusao).slice(0, 10) : null,
        data_posse_gestao: result[0].data_posse_gestao ? String(result[0].data_posse_gestao).slice(0, 10) : null,
      } : null,
    });
  } catch (e: any) {
    console.error('[cipa/save] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
