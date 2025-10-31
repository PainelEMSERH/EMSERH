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

  // Helper: normalize function string the same way on both sides
  const norm = (col: string) => `UPPER(REGEXP_REPLACE(${col}, '[^A-Z0-9]+', '', 'g'))`

  // colaboradores ativos no mês (stg_alterdata)
  try{
    const r:any[] = await prisma.$queryRawUnsafe(\`
      SELECT COUNT(*)::int AS c
      FROM stg_alterdata a
      WHERE a.admissao <= \$1::date
        AND (a.demissao IS NULL OR a.demissao >= \$2::date)
    \`.replace('$1', \`\${fim.toISOString().substring(0,10)}\`).replace('$2', \`\${ini.toISOString().substring(0,10)}\`))
    kpis.colaboradoresAtendidos = Number(r?.[0]?.c || 0)
  }catch(e){}

  // itens planejados no mês (staging)
  try{
    const sql = \`
      WITH elig AS (
        SELECT ${norm('a.funcao')} AS func_key
        FROM stg_alterdata a
        WHERE a.admissao <= '\${fim.toISOString().substring(0,10)}'::date
          AND (a.demissao IS NULL OR a.demissao >= '\${ini.toISOString().substring(0,10)}'::date)
      )
      SELECT COALESCE(SUM(m.quantidade),0)::int AS q
      FROM elig e
      JOIN stg_epi_map m
        ON ${norm('m.alterdata_funcao')} = e.func_key
    \`
    const r:any[] = await prisma.$queryRawUnsafe(sql)
    const planejadosMes = Number(r?.[0]?.q || 0)
    kpis.metaMensal.valorMeta = planejadosMes
    kpis.metaAnual.valorMeta = planejadosMes * 12
  }catch(e){}

  // Top itens planejados no mês
  try{
    const sql = \`
      WITH elig AS (
        SELECT ${norm('a.funcao')} AS func_key
        FROM stg_alterdata a
        WHERE a.admissao <= '\${fim.toISOString().substring(0,10)}'::date
          AND (a.demissao IS NULL OR a.demissao >= '\${ini.toISOString().substring(0,10)}'::date)
      )
      SELECT m.epi_item AS nome, SUM(m.quantidade)::int AS quantidade
      FROM elig e
      JOIN stg_epi_map m
        ON ${norm('m.alterdata_funcao')} = e.func_key
      GROUP BY m.epi_item
      ORDER BY quantidade DESC
      LIMIT 5
    \`
    const rows:any[] = await prisma.$queryRawUnsafe(sql)
    kpis.topItens = (rows||[]).map((x:any, i:number)=>({ itemId: String(i+1), nome: String(x.nome), quantidade: Number(x.quantidade||0) }))
  }catch(e){}

  // Entregas reais no mês (se existir entrega/entrega_item)
  try{
    const rows:any[] = await prisma.$queryRawUnsafe(\`
      SELECT COALESCE(SUM(ei.qtdEntregue),0)::int AS q
        FROM entrega_item ei
        JOIN entrega e ON e.id = ei.entregaId
       WHERE e.data >= '\${ini.toISOString()}'::timestamptz AND e.data <= '\${fim.toISOString()}'::timestamptz
    \`)
    const q = Number(rows?.[0]?.q || 0)
    kpis.itensEntregues = q
    kpis.metaMensal.realizado = q
    kpis.metaAnual.realizado = q // simplificado
  }catch(e){}

  // Pendências e Estoque (se existirem)
  try{
    const p:any[] = await prisma.$queryRawUnsafe(\`SELECT 
      SUM(CASE WHEN status = 'aberta' THEN 1 ELSE 0 END)::int AS abertas,
      SUM(CASE WHEN status = 'aberta' AND prazo < NOW() THEN 1 ELSE 0 END)::int AS vencidas
      FROM pendencia\`)
    kpis.pendenciasAbertas = Number(p?.[0]?.abertas || 0)
    alertas.pendenciasVencidas = Number(p?.[0]?.vencidas || 0)
  }catch(e){}

  try{
    const est:any[] = await prisma.$queryRawUnsafe(\`
      SELECT u.nome AS unidade, i.nome AS item, e.quantidade::int AS quantidade, e.minimo::int AS minimo
        FROM estoque e
        JOIN item i ON i.id = e.itemId
        JOIN unidade u ON u.id = e.unidadeId
       WHERE (e.quantidade < e.minimo)
       ORDER BY e.quantidade ASC
       LIMIT 6\`)
    alertas.estoqueAbaixoMinimo = (est||[]).map((x:any)=>({ unidade: String(x.unidade), item: String(x.item), quantidade: Number(x.quantidade||0), minimo: Number(x.minimo||0) }))
  }catch(e){}

  // Série (últimos 12 meses): planejado e entregue
  try{
    const labels:string[] = []
    const entr:number[] = []
    const its:number[] = []
    for(let i=11;i>=0;i--){
      const d = addMonths(now, -i)
      const y = d.getUTCFullYear(); const m = d.getUTCMonth()+1
      const s = startOfMonth(y,m).toISOString().substring(0,10)
      const e = endOfMonth(y,m).toISOString().substring(0,10)
      labels.push(String(m).padStart(2,'0')+'/'+y)

      // planejado
      try{
        const sql = \`
          WITH elig AS (
            SELECT ${norm('a.funcao')} AS func_key
            FROM stg_alterdata a
            WHERE a.admissao <= '\${e}'::date
              AND (a.demissao IS NULL OR a.demissao >= '\${s}'::date)
          )
          SELECT COALESCE(SUM(m.quantidade),0)::int AS q
          FROM elig e
          JOIN stg_epi_map m
            ON ${norm('m.alterdata_funcao')} = e.func_key
        \`
        const r:any[] = await prisma.$queryRawUnsafe(sql)
        its.push(Number(r?.[0]?.q || 0))
      }catch{ its.push(0) }

      // entregue
      try{
        const r:any[] = await prisma.$queryRawUnsafe(\`
          SELECT COALESCE(SUM(ei.qtdEntregue),0)::int AS q
            FROM entrega_item ei
            JOIN entrega en ON en.id = ei.entregaId
           WHERE en.data >= '\${s}'::date AND en.data <= '\${e}'::date\`)
        entr.push(Number(r?.[0]?.q || 0))
      }catch{ entr.push(0) }
    }
    series = { labels, entregas: entr, itens: its }
  }catch(e){}

  return new Response(JSON.stringify({ kpis, series, alertas }), { headers: { 'content-type': 'application/json' } })
}
