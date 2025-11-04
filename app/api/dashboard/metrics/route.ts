import { NextRequest } from 'next/server'

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
type Alertas = { estoqueAbaixoMinimo: { unidade: string, item: string, quantidade: number, minimo: number }[], pendenciasVencidas: number }

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

  // colaboradores elegíveis no mês (stg_alterdata)
  try{
    const sql = `
      SELECT COUNT(*)::int AS c
      FROM stg_alterdata a
      WHERE a.admissao <= '${fimDate}'::date
        AND (a.demissao IS NULL OR a.demissao >= '${iniDate}'::date)
    `
    const r:any[] = await prisma.$queryRawUnsafe(sql)
    kpis.colaboradoresAtendidos = Number(r?.[0]?.c || 0)
  }catch{}

  // itens planejados do mês (stg_alterdata x stg_epi_map)
  try{
    const elig = `
      WITH elig AS (
        SELECT UPPER(REGEXP_REPLACE(a.funcao,'[^A-Z0-9]+','','g')) AS func_key
        FROM stg_alterdata a
        WHERE a.admissao <= '${fimDate}'::date
          AND (a.demissao IS NULL OR a.demissao >= '${iniDate}'::date)
      )
    `
    const r:any[] = await prisma.$queryRawUnsafe(`${elig}
      SELECT COALESCE(SUM(m.quantidade),0)::int AS q
      FROM elig e
      JOIN stg_epi_map m
        ON UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g')) = e.func_key
    `)
    const planejadosMes = Number(r?.[0]?.q || 0)
    kpis.metaMensal.valorMeta = planejadosMes
    kpis.metaAnual.valorMeta = planejadosMes * 12

    const top:any[] = await prisma.$queryRawUnsafe(`${elig}
      SELECT m.epi_item AS nome, SUM(m.quantidade)::int AS quantidade
      FROM elig e
      JOIN stg_epi_map m
        ON UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g')) = e.func_key
      GROUP BY m.epi_item
      ORDER BY quantidade DESC
      LIMIT 5
    `)
    kpis.topItens = (top||[]).map((x:any,i:number)=>({ itemId: String(i+1), nome: String(x.nome), quantidade: Number(x.quantidade||0) }))
  }catch{}

  // realizado (entrega/entrega_item), se existir
  try{
    const rows:any[] = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(ei.qtdEntregue),0)::int AS q
        FROM entrega_item ei
        JOIN entrega e ON e.id = ei.entregaId
       WHERE e.data >= '${ini.toISOString()}'::timestamptz AND e.data <= '${fim.toISOString()}'::timestamptz
    `)
    const q = Number(rows?.[0]?.q || 0)
    kpis.itensEntregues = q
    kpis.metaMensal.realizado = q
    kpis.metaAnual.realizado = q // simplificado
  }catch{}

  // pendências e estoque (se existirem)
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
    const e:any[] = await prisma.$queryRawUnsafe(`
      SELECT u.nome AS unidade, i.nome AS item, e.quantidade::int AS quantidade, e.minimo::int AS minimo
        FROM estoque e
        JOIN item i ON i.id = e.itemId
        JOIN unidade u ON u.id = e.unidadeId
       WHERE (e.quantidade < e.minimo)
       ORDER BY e.quantidade ASC
       LIMIT 6
    `)
    alertas.estoqueAbaixoMinimo = (e||[]).map((x:any)=>({ unidade: String(x.unidade), item: String(x.item), quantidade: Number(x.quantidade||0), minimo: Number(x.minimo||0) }))
  }catch{}

  // séries 12 meses
  try{
    const labels:string[] = []
    const entr:number[] = []
    const its:number[] = []
    for(let i=11;i>=0;i--){
      const d = addMonths(now, -i)
      const y = d.getUTCFullYear(), m = d.getUTCMonth()+1
      const s = startOfMonth(y,m).toISOString().substring(0,10)
      const e = endOfMonth(y,m).toISOString().substring(0,10)
      labels.push(String(m).padStart(2,'0')+'/'+y)

      // planejado
      try{
        const elig = `
          WITH elig AS (
            SELECT UPPER(REGEXP_REPLACE(a.funcao,'[^A-Z0-9]+','','g')) AS func_key
            FROM stg_alterdata a
            WHERE a.admissao <= '${e}'::date
              AND (a.demissao IS NULL OR a.demissao >= '${s}'::date)
          )
        `
        const r:any[] = await prisma.$queryRawUnsafe(`${elig}
          SELECT COALESCE(SUM(m.quantidade),0)::int AS q
          FROM elig e
          JOIN stg_epi_map m
            ON UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g')) = e.func_key
        `)
        its.push(Number(r?.[0]?.q || 0))
      }catch{ its.push(0) }

      // entregue
      try{
        const r:any[] = await prisma.$queryRawUnsafe(`
          SELECT COALESCE(SUM(ei.qtdEntregue),0)::int AS q
            FROM entrega_item ei
            JOIN entrega en ON en.id = ei.entregaId
           WHERE en.data >= '${s}'::date AND en.data <= '${e}'::date
        `)
        entr.push(Number(r?.[0]?.q || 0))
      }catch{ entr.push(0) }
    }
    series = { labels, entregas: entr, itens: its }
  }catch{}

  return new Response(JSON.stringify({ kpis, series, alertas }), { headers: { 'content-type': 'application/json' } })
}
