
import { NextRequest } from 'next/server'
import { obrigatoriosWhereSql } from '@/data/epiObrigatorio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type KPI = {
  metaMensal: { valorMeta: number, realizado: number },
  variacaoMensalPerc: number,
  metaAnual: { valorMeta: number, realizado: number },
  colaboradoresAtendidos: number,
  itensEntregues: number,
  pendenciasAbertas: number,
  topItens: { itemId: string, nome: string, quantidade: number }[]
}

type Series = { labels: string[], entregas: number[], itens: number[] }

type Alertas = {
  estoqueAbaixoMinimo: { unidade: string, item: string, quantidade: number, minimo: number }[],
  pendenciasVencidas: number
}

function startOfMonth(y:number,m:number){ return new Date(Date.UTC(y, m-1, 1, 0,0,0)) }
function endOfMonth(y:number,m:number){ return new Date(Date.UTC(y, m, 0, 23,59,59)) }
function addMonths(d: Date, delta: number){ const n = new Date(d); n.setUTCMonth(n.getUTCMonth()+delta); return n }

export async function GET(req: NextRequest){
  const { prisma } = await import('@/lib/db')

  const now = new Date()
  const ano = now.getUTCFullYear()
  const mes = now.getUTCMonth()+1
  const ini = startOfMonth(ano, mes)
  const fim = endOfMonth(ano, mes)
  const iniDate = ini.toISOString().substring(0,10)
  const fimDate = fim.toISOString().substring(0,10)

  let kpis: KPI = {
    metaMensal: { valorMeta: 0, realizado: 0 },
    variacaoMensalPerc: 0,
    metaAnual: { valorMeta: 0, realizado: 0 },
    colaboradoresAtendidos: 0,
    itensEntregues: 0,
    pendenciasAbertas: 0,
    topItens: []
  }

  let series: Series = { labels: [], entregas: [], itens: [] }
  let alertas: Alertas = { estoqueAbaixoMinimo: [], pendenciasVencidas: 0 }

  // 1) colaboradores elegíveis no mês (stg_alterdata)
  try{
    const rows:any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c
      FROM stg_alterdata a
      WHERE a.admissao <= '${fimDate}'::date
        AND (a.demissao IS NULL OR a.demissao >= '${iniDate}'::date)
    `)
    kpis.colaboradoresAtendidos = Number(rows?.[0]?.c || 0)
  }catch{}

  // 2) itens planejados do mês - SOMENTE EPIs obrigatórios (stg_alterdata x stg_epi_map)
  try{
    const elig = `
      WITH elig AS (
        SELECT UPPER(REGEXP_REPLACE(a.funcao,'[^A-Z0-9]+','','g')) AS func_key
        FROM stg_alterdata a
        WHERE a.admissao <= '${fimDate}'::date
          AND (a.demissao IS NULL OR a.demissao >= '${iniDate}'::date)
      )
    `;
    const obrigPlan = obrigatoriosWhereSql('m.epi_item');

    const r:any[] = await prisma.$queryRawUnsafe(`${elig}
      SELECT COALESCE(SUM(m.quantidade),0)::int AS q
      FROM elig e
      JOIN stg_epi_map m
        ON UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g')) = e.func_key
       WHERE ${obrigPlan}
    `);
    const planejadosMes = Number(r?.[0]?.q || 0);
    kpis.metaMensal.valorMeta = planejadosMes;
    kpis.metaAnual.valorMeta = planejadosMes * 12;

    const top:any[] = await prisma.$queryRawUnsafe(`${elig}
      SELECT m.epi_item AS nome, SUM(m.quantidade)::int AS quantidade
      FROM elig e
      JOIN stg_epi_map m
        ON UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g')) = e.func_key
       WHERE ${obrigPlan}
      GROUP BY m.epi_item
      ORDER BY quantidade DESC
      LIMIT 5
    `);
    kpis.topItens = (top||[]).map((x:any,i:number)=>({
      itemId: String(i+1),
      nome: String(x.nome),
      quantidade: Number(x.quantidade || 0)
    }));
  }catch{}

  // 3) realizado no mês - SOMENTE EPIs obrigatórios, usando epi_entregas
  try{
    const obrig = obrigatoriosWhereSql('b.item');
    const rows:any[] = await prisma.$queryRawUnsafe(`
      WITH base AS (
        SELECT
          e.item,
          (elem->>'date')::date AS data,
          (elem->>'qty')::int  AS quantidade
        FROM epi_entregas e
        CROSS JOIN LATERAL jsonb_array_elements(e.deliveries) elem
      )
      SELECT COALESCE(SUM(b.quantidade),0)::int AS q
      FROM base b
      WHERE b.data >= '${iniDate}'::date
        AND b.data <= '${fimDate}'::date
        AND ${obrig}
    `);
    const q = Number(rows?.[0]?.q || 0);
    kpis.itensEntregues = q;
    kpis.metaMensal.realizado = q;
    kpis.metaAnual.realizado = q; // simplificado
  }catch{}

  // 4) pendências e estoque (se existirem)
  try{
    const p:any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        SUM(CASE WHEN status = 'aberta' THEN 1 ELSE 0 END)::int AS abertas,
        SUM(CASE WHEN status = 'aberta' AND prazo < NOW() THEN 1 ELSE 0 END)::int AS vencidas
      FROM pendencia
    `)
    kpis.pendenciasAbertas = Number(p?.[0]?.abertas || 0)
    alertas.pendenciasVencidas = Number(p?.[0]?.vencidas || 0)
  }catch{}

  try{
    const eRows:any[] = await prisma.$queryRawUnsafe(`
      SELECT u.nome AS unidade, i.nome AS item, e.quantidade::int AS quantidade, e.minimo::int AS minimo
        FROM estoque e
        JOIN item i ON i.id = e."itemId"
        JOIN unidade u ON u.id = e."unidadeId"
       WHERE (e.quantidade < e.minimo)
       ORDER BY e.quantidade ASC
       LIMIT 6
    `)
    alertas.estoqueAbaixoMinimo = (eRows||[]).map((x:any)=>({
      unidade: String(x.unidade),
      item: String(x.item),
      quantidade: Number(x.quantidade || 0),
      minimo: Number(x.minimo || 0)
    }))
  }catch{}

  // 5) séries dos últimos 6 meses (planejado x entregue) - apenas itens obrigatórios
  try{
    const labels: string[] = []
    const its: number[] = []
    const entr: number[] = []

    const baseRef = new Date(ini)

    for(let delta=-5; delta<=0; delta++){
      const d = addMonths(baseRef, delta)
      const y = d.getUTCFullYear()
      const m = d.getUTCMonth()+1
      const sDate = startOfMonth(y,m).toISOString().substring(0,10)
      const eDate = endOfMonth(y,m).toISOString().substring(0,10)
      labels.push(String(m).padStart(2,'0') + '/' + y)

      // planejado (stg_alterdata x stg_epi_map)
      try{
        const elig = `
          WITH elig AS (
            SELECT UPPER(REGEXP_REPLACE(a.funcao,'[^A-Z0-9]+','','g')) AS func_key
            FROM stg_alterdata a
            WHERE a.admissao <= '${eDate}'::date
              AND (a.demissao IS NULL OR a.demissao >= '${sDate}'::date)
          )
        `;
        const obrigPlan = obrigatoriosWhereSql('m.epi_item');
        const r:any[] = await prisma.$queryRawUnsafe(`${elig}
          SELECT COALESCE(SUM(m.quantidade),0)::int AS q
          FROM elig e
          JOIN stg_epi_map m
            ON UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g')) = e.func_key
           WHERE ${obrigPlan}
        `)
        its.push(Number(r?.[0]?.q || 0))
      }catch{ its.push(0) }

      // entregue (epi_entregas)
      try{
        const obrigEnt = obrigatoriosWhereSql('b.item');
        const r:any[] = await prisma.$queryRawUnsafe(`
          WITH base AS (
            SELECT
              e.item,
              (elem->>'date')::date AS data,
              (elem->>'qty')::int  AS quantidade
            FROM epi_entregas e
            CROSS JOIN LATERAL jsonb_array_elements(e.deliveries) elem
          )
          SELECT COALESCE(SUM(b.quantidade),0)::int AS q
          FROM base b
          WHERE b.data >= '${sDate}'::date
            AND b.data <= '${eDate}'::date
            AND ${obrigEnt}
        `)
        entr.push(Number(r?.[0]?.q || 0))
      }catch{ entr.push(0) }
    }

    series = { labels, entregas: entr, itens: its }
  }catch{}

  // 6) variação mensal (%)
  if (kpis.metaMensal.valorMeta > 0){
    kpis.variacaoMensalPerc = Number(
      (((kpis.metaMensal.realizado - kpis.metaMensal.valorMeta) / kpis.metaMensal.valorMeta) * 100).toFixed(1)
    )
  }else{
    kpis.variacaoMensalPerc = 0
  }

  return new Response(JSON.stringify({ kpis, series, alertas }), { headers: { 'content-type': 'application/json' } })
}
