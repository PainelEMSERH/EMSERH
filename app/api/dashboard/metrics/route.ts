import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type KPIs = {
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

function startOfMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0) }
function endOfMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999) }
function addMonths(d: Date, m: number){ const n = new Date(d); n.setMonth(n.getMonth()+m); return n }

export async function GET(req: NextRequest){
  const now = new Date()
  const mesIni = startOfMonth(now)
  const mesFim = endOfMonth(now)
  const ano = now.getFullYear()
  const mes = now.getMonth()+1

  // Defaults (fallback seguro)
  let kpis: KPIs = {
    metaMensal: { valorMeta: 0, realizado: 0 },
    variacaoMensalPerc: 0,
    metaAnual: { valorMeta: 0, realizado: 0 },
    colaboradoresAtendidos: 0,
    itensEntregues: 0,
    pendenciasAbertas: 0,
    topItens: []
  }
  let series: Series = { labels: Array.from({length:12},(_,i)=>{
      const d = addMonths(now, i-11); return String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()
    }), entregas: Array(12).fill(0), itens: Array(12).fill(0) }
  let alertas: Alertas = { estoqueAbaixoMinimo: [], pendenciasVencidas: 0 }

  try {
    const { prisma } = await import('@/lib/db')

    const { searchParams } = new URL(req.url)
    const scope = searchParams.get('scope') as 'regional'|'unidade'|null
    const regionalId = searchParams.get('regionalId')
    const unidadeId = searchParams.get('unidadeId')

    const entregaWhere:any = { data: { gte: mesIni, lte: mesFim } }
    const metaWhere:any = { ano }
    const pendWhere:any = {}
    const estoqueWhere:any = {}

    if(scope==='regional' && regionalId){
      entregaWhere.unidade = { regionalId }
      metaWhere.escopo = 'regional'; metaWhere.regionalId = regionalId
      pendWhere.colaborador = { unidade: { regionalId } }
      estoqueWhere.unidade = { regionalId }
    } else if(scope==='unidade' && unidadeId){
      entregaWhere.unidadeId = unidadeId
      metaWhere.escopo = 'unidade'; metaWhere.unidadeId = unidadeId
      pendWhere.colaborador = { unidadeId }
      estoqueWhere.unidadeId = unidadeId
    }

    // KPIs básicos com try individuais (se a tabela não existir, seguimos com zero)
    try {
      const [cEntregas, sumItens, colabsDistinct] = await Promise.all([
        prisma.entrega.count({ where: entregaWhere }),
        prisma.entregaItem.aggregate({ _sum: { qtdEntregue: true }, where: { entrega: entregaWhere } }),
        prisma.entrega.findMany({ where: entregaWhere, select: { colaboradorId: true }, distinct: ['colaboradorId'] }),
      ])
      kpis.itensEntregues = Number(sumItens._sum.qtdEntregue ?? 0)
      kpis.colaboradoresAtendidos = colabsDistinct.length
      // usa metaMensal.realizado como entregas (se não houver meta cadastrada)
      if (kpis.metaMensal.realizado === 0) { kpis.metaMensal.realizado = cEntregas }
      if (kpis.metaAnual.realizado === 0) { kpis.metaAnual.realizado = cEntregas }
    } catch {}

    try {
      const [open, overdue] = await Promise.all([
        prisma.pendencia.count({ where: { status: 'aberta', ...pendWhere } }),
        prisma.pendencia.count({ where: { status: 'aberta', prazo: { lt: now }, ...pendWhere } }),
      ])
      kpis.pendenciasAbertas = open
      alertas.pendenciasVencidas = overdue
    } catch {}

    try {
      const [mens, anual, prev] = await Promise.all([
        prisma.meta.aggregate({ _sum: { valorMeta: true, valorRealizado: true }, where: { ...metaWhere, periodo: 'mensal', mes } }),
        prisma.meta.aggregate({ _sum: { valorMeta: true, valorRealizado: true }, where: { ...metaWhere, periodo: 'anual' } }),
        prisma.meta.aggregate({ _sum: { valorRealizado: true }, where: { ...metaWhere, periodo: 'mensal', mes: mes===1?12:mes-1, ano: mes===1?ano-1:ano } }),
      ])
      kpis.metaMensal = { valorMeta: Number(mens._sum.valorMeta ?? 0), realizado: Number(mens._sum.valorRealizado ?? 0) }
      kpis.metaAnual  = { valorMeta: Number(anual._sum.valorMeta ?? 0), realizado: Number(anual._sum.valorRealizado ?? 0) }
      const prevReal = Number(prev._sum.valorRealizado ?? 0)
      kpis.variacaoMensalPerc = prevReal>0 ? ((kpis.metaMensal.realizado - prevReal)/prevReal)*100 : 0
    } catch {}

    try {
      const top = await prisma.entregaItem.groupBy({
        by: ['itemId'],
        _sum: { qtdEntregue: true },
        where: { entrega: entregaWhere },
        orderBy: { _sum: { qtdEntregue: 'desc' } },
        take: 5
      })
      const ids = top.map(t=>t.itemId)
      const items = ids.length ? await prisma.item.findMany({ where: { id: { in: ids } }, select: { id:true, nome:true } }) : []
      const nameById = Object.fromEntries(items.map(i=>[i.id, i.nome]))
      kpis.topItens = top.map(t => ({ itemId: t.itemId, nome: nameById[t.itemId] ?? 'Item', quantidade: Number(t._sum.qtdEntregue ?? 0) }))
    } catch {}

    try {
      const labels:string[] = []
      const entr:number[] = []
      const its:number[] = []
      for(let i=11;i>=0;i--){
        const d = addMonths(now, -i)
        const iIni = startOfMonth(d)
        const iFim = endOfMonth(d)
        const w:any = { data: { gte: iIni, lte: iFim } }
        if(scope==='regional' && regionalId) w.unidade = { regionalId }
        else if(scope==='unidade' && unidadeId) w.unidadeId = unidadeId
        const [c, s] = await Promise.all([
          prisma.entrega.count({ where: w }),
          prisma.entregaItem.aggregate({ _sum: { qtdEntregue: true }, where: { entrega: w } }),
        ])
        labels.push(String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear())
        entr.push(c); its.push(Number(s._sum.qtdEntregue ?? 0))
      }
      series = { labels, entregas: entr, itens: its }
    } catch {}

    try {
      const all = await prisma.estoque.findMany({
        where: estoqueWhere,
        select: { quantidade: true, minimo: true, item: { select: { nome: true } }, unidade: { select: { nome: true } } },
        take: 200
      })
      alertas.estoqueAbaixoMinimo = all
        .filter(e => (e.quantidade ?? 0) < (e.minimo ?? 0))
        .sort((a,b)=>(a.quantidade??0)-(b.quantidade??0))
        .slice(0,6)
        .map(e => ({ unidade: e.unidade?.nome ?? 'Unidade', item: e.item?.nome ?? 'Item', quantidade: e.quantidade ?? 0, minimo: e.minimo ?? 0 }))
    } catch {}

  } catch (e) {
    // Se algo crítico falhar (ex: import), ainda assim retornamos payload padrão.
    console.error('[dashboard/metrics] erro crítico', e)
  }

  return new Response(JSON.stringify({ kpis, series, alertas }), { headers: { 'content-type': 'application/json' } })
}
