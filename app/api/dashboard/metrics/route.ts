import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

function int(v: string|null, d: number){ const n = Number(v); return Number.isFinite(n)? n : d }
function firstDayOfMonth(y:number,m:number){ return new Date(Date.UTC(y, m-1, 1, 0,0,0)) }
function lastDayOfMonth(y:number,m:number){ return new Date(Date.UTC(y, m, 0, 23,59,59)) }

export async function GET(req: NextRequest){
  try {
    const url = new URL(req.url)
    const escopo = (url.searchParams.get('escopo') ?? 'unidade') as 'regional'|'unidade'
    const regionalId = url.searchParams.get('regionalId') || undefined
    const unidadeId  = url.searchParams.get('unidadeId') || undefined
    const year  = int(url.searchParams.get('year'), new Date().getUTCFullYear())
    const month = int(url.searchParams.get('month'), new Date().getUTCMonth()+1)

    const ini = firstDayOfMonth(year, month)
    const fim = lastDayOfMonth(year, month)

    const whereScopeEntrega:any = {}
    const whereScopePend:any = {}
    const whereScopeEst:any = {}
    if(escopo==='regional' && regionalId){
      whereScopeEntrega.unidade = { regionalId }
      whereScopePend.colaborador = { unidade: { regionalId } }
      whereScopeEst.unidade = { regionalId }
    } else if (escopo==='unidade' && unidadeId){
      whereScopeEntrega.unidadeId = unidadeId
      whereScopePend.colaborador = { unidadeId }
      whereScopeEst.unidadeId = unidadeId
    }

    const [entregasPeriodo, itensEntreguesPeriodo, colabsPeriodo, pendAbertas, pendVencidas] = await Promise.all([
      prisma.entrega.count({ where: { ...whereScopeEntrega, data: { gte: ini, lte: fim } } }),
      prisma.entregaItem.aggregate({ _sum: { qtdEntregue: true }, where: { entrega: { ...whereScopeEntrega, data: { gte: ini, lte: fim } } } }),
      prisma.entrega.findMany({ where: { ...whereScopeEntrega, data: { gte: ini, lte: fim } }, select: { colaboradorId: true }, distinct: ['colaboradorId'] }),
      prisma.pendencia.count({ where: { ...whereScopePend, status: 'aberta' } }),
      prisma.pendencia.count({ where: { ...whereScopePend, status: 'aberta', prazo: { lt: new Date() } } }),
    ])

    const itensEntregues = Number(itensEntreguesPeriodo._sum.qtdEntregue ?? 0)
    const colaboradoresAtendidos = colabsPeriodo.length

    const [metaMensal, metaAnual] = await Promise.all([
      prisma.meta.findFirst({ where: { escopo, ...(escopo==='regional'? { regionalId } : { unidadeId }), periodo: 'mensal', ano: year, mes: month } }),
      prisma.meta.findFirst({ where: { escopo, ...(escopo==='regional'? { regionalId } : { unidadeId }), periodo: 'anual', ano: year } }),
    ])

    const prevDate = new Date(Date.UTC(year, month-2, 1))
    const prevIni = firstDayOfMonth(prevDate.getUTCFullYear(), prevDate.getUTCMonth()+1)
    const prevFim = lastDayOfMonth(prevDate.getUTCFullYear(), prevDate.getUTCMonth()+1)
    const entregasPrev = await prisma.entrega.count({ where: { ...whereScopeEntrega, data: { gte: prevIni, lte: prevFim } } })
    const variacaoMensalPerc = entregasPrev ? ((entregasPeriodo - entregasPrev)/entregasPrev)*100 : (entregasPeriodo?100:0)

    // Top itens do mês
    const topItensRaw = await prisma.entregaItem.groupBy({
      by: ['itemId'],
      where: { entrega: { ...whereScopeEntrega, data: { gte: ini, lte: fim } } },
      _sum: { qtdEntregue: true },
      orderBy: { _sum: { qtdEntregue: 'desc' } },
      take: 5
    })
    const itemsById = await prisma.item.findMany({ where: { id: { in: topItensRaw.map(t=>t.itemId) } }, select: { id: true, nome: true } })
    const names = Object.fromEntries(itemsById.map(i=>[i.id, i.nome]))
    const topItens = topItensRaw.map(t=>({ itemId: t.itemId, nome: names[t.itemId] ?? t.itemId, quantidade: Number(t._sum.qtdEntregue ?? 0) }))

    // Series (12m)
    const seriesMonths:string[] = []
    const entregas12:number[] = []
    const itens12:number[] = []
    for(let i=11;i>=0;i--){
      const d = new Date(Date.UTC(year, month-1 - i, 1))
      const y = d.getUTCFullYear(), m = d.getUTCMonth()+1
      const s = firstDayOfMonth(y,m), e = lastDayOfMonth(y,m)
      seriesMonths.push(`${y}-${String(m).padStart(2,'0')}`)
      const [cE, sI] = await Promise.all([
        prisma.entrega.count({ where: { ...whereScopeEntrega, data: { gte: s, lte: e } } }),
        prisma.entregaItem.aggregate({ _sum: { qtdEntregue: true }, where: { entrega: { ...whereScopeEntrega, data: { gte: s, lte: e } } } }),
      ])
      entregas12.push(cE)
      itens12.push(Number(sI._sum.qtdEntregue ?? 0))
    }

    // Estoque abaixo do mínimo
    const lowStock = await prisma.estoque.findMany({
      where: { ...whereScopeEst, quantidade: { lt: osql('minimo') } } as any
    }).catch(async () => {
      // Neon may not support osql; fallback manual query:
      const all = await prisma.estoque.findMany({ where: whereScopeEst, select: { id:true, quantidade:true, minimo:true, item: { select: { nome:true } }, unidade: { select: { nome:true } } }, take: 10 })
      return all.filter(e => (e.quantidade ?? 0) < (e.minimo ?? 0)).map(e => ({ item: e.item.nome, unidade: e.unidade.nome, quantidade: e.quantidade, minimo: e.minimo }))
    })

    return NextResponse.json({
      period: { year, month },
      escopo, regionalId, unidadeId,
      kpis: {
        metaMensal: metaMensal ? { valorMeta: metaMensal.valorMeta, realizado: metaMensal.valorRealizado } : { valorMeta: 0, realizado: entregasPeriodo },
        metaAnual:  metaAnual  ? { valorMeta: metaAnual.valorMeta,  realizado: metaAnual.valorRealizado  } : { valorMeta: 0, realizado: entregasPeriodo },
        variacaoMensalPerc,
        colaboradoresAtendidos,
        itensEntregues,
        pendenciasAbertas: pendAbertas,
        pendenciasVencidas: pendVencidas,
        topItens,
      },
      series: { labels: seriesMonths, entregas: entregas12, itens: itens12 },
      alerts: {
        lowStock: lowStock,
        pendenciasVencidas: pendVencidas
      }
    })
  } catch (e:any){
    // Safe zeros (keeps UI working even before DB is ready)
    return NextResponse.json({
      fallback: true,
      kpis: { metaMensal: { valorMeta: 0, realizado: 0 }, metaAnual: { valorMeta: 0, realizado: 0 }, variacaoMensalPerc: 0, colaboradoresAtendidos: 0, itensEntregues: 0, pendenciasAbertas: 0, pendenciasVencidas: 0, topItens: [] },
      series: { labels: [], entregas: [], itens: [] },
      alerts: { lowStock: [], pendenciasVencidas: 0 }
    }, { status: 200 })
  }
}

// helper for computed column (attempt) - noop in Prisma client, kept for readability above
function osql(_field: string){ return undefined as any }
