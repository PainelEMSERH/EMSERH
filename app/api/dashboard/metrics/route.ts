import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}
function addMonths(d: Date, m: number) {
  const n = new Date(d); n.setMonth(n.getMonth() + m); return n
}

export async function GET(req: NextRequest) {
  // Importa prisma apenas em runtime (evita erro no build do Vercel)
  const { prisma } = await import('@/lib/db')

  // Parâmetros opcionais (escopo)
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') as 'regional' | 'unidade' | null
  const regionalId = searchParams.get('regionalId')
  const unidadeId = searchParams.get('unidadeId')

  // Período atual = mês corrente
  const now = new Date()
  const iniMes = startOfMonth(now)
  const fimMes = endOfMonth(now)
  const ano = now.getFullYear()
  const mes = now.getMonth() + 1

  // Filtros de escopo
  const entregaWhere:any = { data: { gte: iniMes, lte: fimMes } }
  const metaWhere:any = { ano }
  const pendWhere:any = {}
  const estoqueWhere:any = {}
  if(scope === 'regional' && regionalId){
    entregaWhere.unidade = { regionalId }
    metaWhere.escopo = 'regional'
    metaWhere.regionalId = regionalId
    pendWhere.regionalId = regionalId
    estoqueWhere.unidade = { regionalId }
  } else if(scope === 'unidade' && unidadeId){
    entregaWhere.unidadeId = unidadeId
    metaWhere.escopo = 'unidade'
    metaWhere.unidadeId = unidadeId
    pendWhere.unidadeId = unidadeId
    estoqueWhere.unidadeId = unidadeId
  }

  // KPIs básicos (mês)
  const [
    entregasMes,
    itensMesAgg,
    colabsMesAgg,
    pendAbertas,
    pendVencidas
  ] = await Promise.all([
    prisma.entrega.count({ where: entregaWhere }),
    prisma.entregaItem.aggregate({
      _sum: { qtdEntregue: true },
      where: { entrega: entregaWhere }
    }),
    prisma.entrega.findMany({
      where: entregaWhere,
      select: { colaboradorId: true },
      distinct: ['colaboradorId']
    }),
    prisma.pendencia.count({ where: { status: 'aberta', ...pendWhere } }),
    prisma.pendencia.count({ where: { status: 'aberta', prazo: { lt: now }, ...pendWhere } }),
  ])

  const itensMes = Number(itensMesAgg._sum.qtdEntregue ?? 0)
  const colabsMes = colabsMesAgg.length

  // Meta mensal e anual (somatório do escopo)
  const [metaMensalAgg, metaAnualAgg, metaMensalPrevAgg] = await Promise.all([
    prisma.meta.aggregate({
      _sum: { valorMeta: true, valorRealizado: true },
      where: { ...metaWhere, periodo: 'mensal', mes }
    }),
    prisma.meta.aggregate({
      _sum: { valorMeta: true, valorRealizado: true },
      where: { ...metaWhere, periodo: 'anual' }
    }),
    prisma.meta.aggregate({
      _sum: { valorRealizado: true },
      where: { ...metaWhere, periodo: 'mensal', mes: mes === 1 ? 12 : mes - 1, ano: mes === 1 ? ano - 1 : ano }
    }),
  ])

  const metaMensal = {
    valorMeta: Number(metaMensalAgg._sum.valorMeta ?? 0),
    realizado: Number(metaMensalAgg._sum.valorRealizado ?? 0),
  }
  const metaAnual = {
    valorMeta: Number(metaAnualAgg._sum.valorMeta ?? 0),
    realizado: Number(metaAnualAgg._sum.valorRealizado ?? 0),
  }
  const realizadoPrev = Number(metaMensalPrevAgg._sum.valorRealizado ?? 0)
  const variacaoMensalPerc = realizadoPrev > 0 ? ((metaMensal.realizado - realizadoPrev) / realizadoPrev) * 100 : 0

  // Top itens no mês
  const topItensRaw = await prisma.entregaItem.groupBy({
    by: ['itemId'],
    _sum: { qtdEntregue: true },
    where: { entrega: entregaWhere },
    orderBy: { _sum: { qtdEntregue: 'desc' } },
    take: 5
  })
  const itemIds = topItensRaw.map(t => t.itemId)
  const itens = itemIds.length ? await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, nome: true }
  }) : []
  const topItens = topItensRaw.map(t => {
    const it = itens.find(i => i.id === t.itemId)
    return { itemId: t.itemId, nome: it?.nome ?? 'Item', quantidade: Number(t._sum.qtdEntregue ?? 0) }
  })

  // Série 12 meses
  const labels:string[] = []
  const entregasSeries:number[] = []
  const itensSeries:number[] = []
  for(let i = 11; i >= 0; i--){
    const d = addMonths(now, -i)
    const iIni = startOfMonth(d)
    const iFim = endOfMonth(d)

    const whereEntrega:any = { data: { gte: iIni, lte: iFim } }
    if(scope === 'regional' && regionalId){
      whereEntrega.unidade = { regionalId }
    } else if(scope === 'unidade' && unidadeId){
      whereEntrega.unidadeId = unidadeId
    }

    const [c, sum] = await Promise.all([
      prisma.entrega.count({ where: whereEntrega }),
      prisma.entregaItem.aggregate({ _sum: { qtdEntregue: true }, where: { entrega: whereEntrega } })
    ])

    labels.push(String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getFullYear()))
    entregasSeries.push(c)
    itensSeries.push(Number(sum._sum.qtdEntregue ?? 0))
  }

  // Alertas de estoque baixo
  const estoqueAll = await prisma.estoque.findMany({
    where: estoqueWhere,
    select: { quantidade: true, minimo: true, item: { select: { nome: true } }, unidade: { select: { nome: true } } },
    take: 200
  })
  const estoqueBaixo = estoqueAll
    .filter(e => (e.quantidade ?? 0) < (e.minimo ?? 0))
    .sort((a,b) => (a.quantidade ?? 0) - (b.quantidade ?? 0))
    .slice(0, 6)

  const estoqueAbaixoMinimo = estoqueBaixo
    .filter(e => (e.quantidade ?? 0) < (e.minimo ?? 0))
    .map(e => ({ unidade: e.unidade?.nome ?? 'Unidade', item: e.item?.nome ?? 'Item', quantidade: e.quantidade ?? 0, minimo: e.minimo ?? 0 }))

  return new Response(JSON.stringify({
    kpis: {
      metaMensal,
      variacaoMensalPerc,
      metaAnual,
      colaboradoresAtendidos: colabsMes,
      itensEntregues: itensMes,
      pendenciasAbertas: pendAbertas,
      topItens
    },
    series: {
      labels,
      entregas: entregasSeries,
      itens: itensSeries
    },
    alertas: {
      estoqueAbaixoMinimo,
      pendenciasVencidas: pendVencidas
    }
  }), { headers: { 'content-type': 'application/json' } })
}
