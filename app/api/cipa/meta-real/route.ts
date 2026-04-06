import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';

/**
 * Meta vs Real CIPA:
 * - Meta do mês = quantidade de atividades programadas para aquele mês (data_fim_prevista no mês)
 * - Real do mês = quantidade de atividades realizadas naquele mês (data_conclusao no mês)
 * - % Meta do mês = (meta do mês / total atividades) * 100
 * - % Real do mês = (real do mês / total atividades) * 100
 * - Meta acumulada = jan, jan+fev, jan+fev+mar... até 100%
 * - Real acumulado = idem
 */
export async function GET(req: NextRequest) {
  try {
    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
      ) AS exists
    `);
    if (!hasTable?.[0]?.exists) {
      return NextResponse.json({
        ok: true,
        meta: {},
        realAcumulado: {},
        totalMeta: 0,
        totalReal: 0,
        ano: parseInt(new URL(req.url).searchParams.get('ano') || '2025', 10),
      });
    }

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const ano = parseInt(url.searchParams.get('ano') || '2025', 10);

    const wh: string[] = [`ano_gestao = ${ano}`];
    if (regional) wh.push(`UPPER(TRIM(regional)) = UPPER('${String(regional).replace(/'/g, "''")}')`);
    const whereSql = `WHERE ${wh.join(' AND ')}`;

    // Total de atividades (meta = quantidade de ações a serem feitas)
    let totalMeta = 0;
    let metaMeses: Record<string, number> = {};
    let realMeses: Record<string, number> = {};
    let totalReal = 0;

    const totalMetaResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total FROM cronograma_cipa ${whereSql}
    `);
    totalMeta = Number(totalMetaResult[0]?.total ?? 0);

    // 2026: se não há dados no banco OU se há dados mas nenhum com data_fim_prevista em 2026, usar dados calculados
    let useComputed = false;
    if (ano === 2026 && totalMeta === 0) {
      useComputed = true;
    } else if (ano === 2026 && totalMeta > 0) {
      // Verifica se há pelo menos uma atividade com data_fim_prevista em 2026
      const check2026: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS total FROM cronograma_cipa
        ${whereSql}
        AND EXTRACT(YEAR FROM data_fim_prevista::date) = 2026
      `);
      if (Number(check2026[0]?.total ?? 0) === 0) {
        useComputed = true;
      }
    }

    if (ano === 2026 && useComputed) {
      const rows2026 = await compute2026From2025(prisma, regional, '');
      totalMeta = rows2026.length;
      totalReal = 0;
      
      // Inicializa todos os meses com 0
      for (let m = 1; m <= 12; m++) {
        const mesStr = String(m).padStart(2, '0');
        metaMeses[mesStr] = 0;
        realMeses[mesStr] = 0;
      }
      
      // Meta por mês = atividades cuja data_fim_prevista cai NAQUELE mês (não acumulado)
      for (const row of rows2026) {
        if (!row.data_fim_prevista) continue;
        const fimPrevistaStr = row.data_fim_prevista.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fimPrevistaStr)) continue;
        const [, monthStr] = fimPrevistaStr.split('-');
        const monthNum = parseInt(monthStr, 10);
        if (monthNum >= 1 && monthNum <= 12) {
          const mesStr = String(monthNum).padStart(2, '0');
          metaMeses[mesStr] = (metaMeses[mesStr] ?? 0) + 1;
        }
      }
    } else {
      // Total concluídas (data_conclusao preenchida).
      const totalRealResult: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS total FROM cronograma_cipa ${whereSql} 
        AND data_conclusao IS NOT NULL 
      `);
      totalReal = Number(totalRealResult[0]?.total ?? 0);

      // Meta por mês = atividades cuja data_fim_prevista cai NAQUELE mês (não acumulado)
      for (let m = 1; m <= 12; m++) {
        const mesStr = String(m).padStart(2, '0');
        const firstDay = `${ano}-${mesStr}-01`;
        const lastDay = new Date(ano, m, 0);
        const lastDayStr = `${ano}-${mesStr}-${String(lastDay.getDate()).padStart(2, '0')}`;
        const anoFilter = ano === 2026 ? `AND EXTRACT(YEAR FROM data_fim_prevista::date) = 2026` : '';
        const r: any[] = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS total FROM cronograma_cipa
          ${whereSql}
          AND data_fim_prevista::date >= '${firstDay}'::date AND data_fim_prevista::date <= '${lastDayStr}'::date
          ${anoFilter}
        `);
        metaMeses[mesStr] = Number(r[0]?.total ?? 0);
      }

      // Real por mês = atividades com data_conclusao NAQUELE mês (não acumulado)
      for (let m = 1; m <= 12; m++) {
        const mesStr = String(m).padStart(2, '0');
        const firstDay = `${ano}-${mesStr}-01`;
        const lastDay = new Date(ano, m, 0);
        const lastDayStr = `${ano}-${mesStr}-${String(lastDay.getDate()).padStart(2, '0')}`;
        const r: any[] = await prisma.$queryRawUnsafe(`
          SELECT COUNT(*)::int AS total FROM cronograma_cipa
          ${whereSql}
          AND data_conclusao IS NOT NULL
          AND data_conclusao::date >= '${firstDay}'::date AND data_conclusao::date <= '${lastDayStr}'::date
        `);
        realMeses[mesStr] = Number(r[0]?.total ?? 0);
      }
    }

    const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const meta: Record<string, number> = {};
    const real: Record<string, number> = {};
    const metaPercent: Record<string, number> = {};
    const realPercent: Record<string, number> = {};
    const metaPercentAcumulado: Record<string, number> = {};
    const realPercentAcumulado: Record<string, number> = {};
    const evolucaoMensal: Record<string, number> = {};

    /** Acumulado por soma de % mensais arredondados pode passar de 100% (ex.: 100,01%). Usar contagens. */
    let metaQtdAcum = 0;
    let realQtdAcum = 0;
    meses.forEach((mes) => {
      const metaVal = metaMeses[mes] ?? 0;
      const realVal = realMeses[mes] ?? 0;
      meta[mes] = metaVal;
      real[mes] = realVal;

      // % da meta do mês = (atividades programadas no mês / total atividades) * 100
      metaPercent[mes] = totalMeta > 0 ? Math.round((metaVal / totalMeta) * 10000) / 100 : 0;
      // % do real do mês = (atividades executadas no mês / total atividades) * 100
      realPercent[mes] = totalMeta > 0 ? Math.round((realVal / totalMeta) * 10000) / 100 : 0;

      metaQtdAcum += metaVal;
      realQtdAcum += realVal;
      metaPercentAcumulado[mes] =
        totalMeta > 0
          ? Math.min(100, Math.round((metaQtdAcum / totalMeta) * 10000) / 100)
          : 0;
      realPercentAcumulado[mes] =
        totalMeta > 0
          ? Math.min(100, Math.round((realQtdAcum / totalMeta) * 10000) / 100)
          : 0;

      // Evolução = % real do mês (contribuição mensal)
      evolucaoMensal[mes] = realPercent[mes];
    });

    if (totalMeta > 0 && meses.length > 0) {
      metaPercentAcumulado['12'] = 100;
      if (totalReal >= totalMeta) {
        realPercentAcumulado['12'] = 100;
      }
    }

    const percentTotal = totalMeta > 0 ? Math.round((totalReal / totalMeta) * 100) : 0;

    return NextResponse.json({
      ok: true,
      meta,
      real,
      realAcumulado: real, // compatibilidade
      metaPercent,
      realPercent,
      metaPercentAcumulado,
      realPercentAcumulado,
      evolucaoMensal,
      totalMeta,
      totalReal,
      percentTotal,
      ano,
    });
  } catch (e: any) {
    console.error('[cipa/meta-real] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
