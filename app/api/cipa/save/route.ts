import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';
import { cipaUnidadeMatchSql, resolveCipaUnidade } from '@/lib/cipa/unidades';

function parseDateInput(value: unknown): string | null | 'invalid' {
  if (value === null || value === undefined || !String(value).trim()) return null;
  const dtStr = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dtStr)) return dtStr;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dtStr)) {
    const [dd, mm, yyyy] = dtStr.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return 'invalid';
}

async function rowExists(
  regParam: string,
  uniParam: string,
  anoNum: number,
  codNum: number,
): Promise<boolean> {
  const unitSql = cipaUnidadeMatchSql(uniParam);
  const found: any[] = await prisma.$queryRawUnsafe(
    `
      SELECT 1
      FROM cronograma_cipa
      WHERE UPPER(TRIM(regional)) = UPPER(TRIM($1))
        AND ${unitSql}
        AND ano_gestao = $2
        AND atividade_codigo = $3
      LIMIT 1
    `,
    regParam,
    anoNum,
    codNum,
  );
  return Boolean(found?.length);
}

async function ensureRegionalRows2026(regParam: string) {
  const computed = await compute2026From2025(prisma, regParam, '');
  for (const a of computed) {
    const exists = await rowExists(a.regional, a.unidade, 2026, a.atividade_codigo);
    if (exists) continue;
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO cronograma_cipa (
          regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
          data_inicio_prevista, data_fim_prevista, data_conclusao, data_posse_gestao
        )
        VALUES ($1, $2, 2026, $3, $4, $5::date, $6::date, NULL, $7::date)
      `,
      a.regional,
      a.unidade,
      a.atividade_codigo,
      a.atividade_nome,
      a.data_inicio_prevista,
      a.data_fim_prevista,
      a.data_posse_gestao,
    );
  }
}

/**
 * API para atualizar datas de uma atividade CIPA (previstas e/ou conclusão).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      regional,
      unidade,
      ano_gestao,
      atividade_codigo,
      atividade_nome,
      data_posse_gestao,
      data_inicio_prevista,
      data_fim_prevista,
      data_conclusao,
    } = body;

    if (!regional || !unidade || !ano_gestao || !atividade_codigo) {
      return NextResponse.json(
        { ok: false, error: 'Regional, unidade, ano e código da atividade são obrigatórios' },
        { status: 400 },
      );
    }

    const hasInicio = Object.prototype.hasOwnProperty.call(body, 'data_inicio_prevista');
    const hasFim = Object.prototype.hasOwnProperty.call(body, 'data_fim_prevista');
    const hasConclusao = Object.prototype.hasOwnProperty.call(body, 'data_conclusao');

    if (!hasInicio && !hasFim && !hasConclusao) {
      return NextResponse.json(
        { ok: false, error: 'Informe ao menos uma data para atualizar' },
        { status: 400 },
      );
    }

    const inicioDate = hasInicio ? parseDateInput(data_inicio_prevista) : undefined;
    const fimDate = hasFim ? parseDateInput(data_fim_prevista) : undefined;
    const conclusaoDate = hasConclusao ? parseDateInput(data_conclusao) : undefined;

    if (inicioDate === 'invalid' || fimDate === 'invalid' || conclusaoDate === 'invalid') {
      return NextResponse.json(
        { ok: false, error: 'Formato de data inválido. Use DD/MM/YYYY ou YYYY-MM-DD' },
        { status: 400 },
      );
    }

    const regParam = String(regional).trim();
    const anoNum = parseInt(String(ano_gestao), 10);
    const codNum = parseInt(String(atividade_codigo), 10);

    if (isNaN(anoNum) || isNaN(codNum)) {
      return NextResponse.json(
        { ok: false, error: 'Ano e código da atividade devem ser números' },
        { status: 400 },
      );
    }

    const uniParam = resolveCipaUnidade(String(unidade).trim(), codNum);

    let exists = await rowExists(regParam, uniParam, anoNum, codNum);
    if (!exists && anoNum === 2026) {
      await ensureRegionalRows2026(regParam);
      exists = await rowExists(regParam, uniParam, anoNum, codNum);
    }

    if (!exists) {
      const nomeParam = String(atividade_nome ?? '').trim();
      if (!nomeParam) {
        return NextResponse.json(
          { ok: false, error: 'Registro não encontrado. Informe o nome da atividade para criar.' },
          { status: 404 },
        );
      }

      const posseParsed = parseDateInput(data_posse_gestao);
      if (posseParsed === 'invalid') {
        return NextResponse.json(
          { ok: false, error: 'Data de posse inválida para criar o registro' },
          { status: 400 },
        );
      }

      await prisma.$executeRawUnsafe(
        `
          INSERT INTO cronograma_cipa (
            regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
            data_inicio_prevista, data_fim_prevista, data_conclusao, data_posse_gestao
          )
          VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8::date, $9::date)
        `,
        regParam,
        uniParam,
        anoNum,
        codNum,
        nomeParam,
        hasInicio ? inicioDate : null,
        hasFim ? fimDate : null,
        hasConclusao ? conclusaoDate : null,
        posseParsed,
      );
    } else {
      const sets: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (hasInicio) {
        sets.push(`data_inicio_prevista = $${idx}::date`);
        params.push(inicioDate);
        idx++;
      }
      if (hasFim) {
        sets.push(`data_fim_prevista = $${idx}::date`);
        params.push(fimDate);
        idx++;
      }
      if (hasConclusao) {
        sets.push(`data_conclusao = $${idx}::date`);
        params.push(conclusaoDate);
        idx++;
      }

      const unitSql = cipaUnidadeMatchSql(uniParam);
      sets.push(`unidade = $${idx}`);
      params.push(uniParam);
      idx++;
      params.push(regParam, anoNum, codNum);
      await prisma.$executeRawUnsafe(
        `
          UPDATE cronograma_cipa
          SET ${sets.join(', ')}
          WHERE UPPER(TRIM(regional)) = UPPER(TRIM($${idx}))
            AND ${unitSql}
            AND ano_gestao = $${idx + 1}
            AND atividade_codigo = $${idx + 2}
        `,
        ...params,
      );
    }

    const unitSql = cipaUnidadeMatchSql(uniParam);
    const result: any[] = await prisma.$queryRawUnsafe(
      `
        SELECT id, regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
               data_inicio_prevista::text AS data_inicio_prevista,
               data_fim_prevista::text AS data_fim_prevista,
               data_conclusao::text AS data_conclusao,
               data_posse_gestao::text AS data_posse_gestao
        FROM cronograma_cipa
        WHERE UPPER(TRIM(regional)) = UPPER(TRIM($1))
          AND ${unitSql}
          AND ano_gestao = $2
          AND atividade_codigo = $3
        LIMIT 1
      `,
      regParam,
      anoNum,
      codNum,
    );

    return NextResponse.json({
      ok: true,
      row: result[0]
        ? {
            id: result[0].id,
            regional: String(result[0].regional ?? ''),
            unidade: String(result[0].unidade ?? ''),
            ano_gestao: Number(result[0].ano_gestao) || 0,
            atividade_codigo: Number(result[0].atividade_codigo) || 0,
            atividade_nome: String(result[0].atividade_nome ?? ''),
            data_inicio_prevista: result[0].data_inicio_prevista
              ? String(result[0].data_inicio_prevista).slice(0, 10)
              : null,
            data_fim_prevista: result[0].data_fim_prevista
              ? String(result[0].data_fim_prevista).slice(0, 10)
              : null,
            data_conclusao: result[0].data_conclusao
              ? String(result[0].data_conclusao).slice(0, 10)
              : null,
            data_posse_gestao: result[0].data_posse_gestao
              ? String(result[0].data_posse_gestao).slice(0, 10)
              : null,
          }
        : null,
    });
  } catch (e: any) {
    console.error('[cipa/save] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
