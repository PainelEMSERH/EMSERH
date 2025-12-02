'use client'
import React, { useEffect, useMemo, useState } from 'react'
// AppShell removido; usando layout de /(app)
import { formatThousands as _formatThousands } from '@/components/utils/Utils'
import DoughnutChart from '@/components/charts/DoughnutChart'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js'
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend)

type KPI = {
  metaMensal: { valorMeta: number, realizado: number },
  variacaoMensalPerc: number,
  metaAnual: { valorMeta: number, realizado: number },
  colaboradoresAtendidos: number,
  itensEntregues: number,
  pendenciasAbertas: number,
  topItens: { itemId: string, nome: string, quantidade: number }[]
}

type Series = {
  labels: string[],
  entregas: number[],
  itens: number[]
}

type Alertas = {
  estoqueAbaixoMinimo: { unidade: string, item: string, quantidade: number, minimo: number }[],
  pendenciasVencidas: number
}

type Payload = {
  kpis: KPI,
  series: Series,
  alertas: Alertas
}

const formatThousands = (v:number) => _formatThousands ? _formatThousands(v) : (v ?? 0).toLocaleString('pt-BR')

export default function DashboardEPI(){
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function fetchData(){
      try{
        setLoading(true)
        const res = await fetch('/api/dashboard/metrics', { cache: 'no-store' })
        if(!res.ok) throw new Error('Falha ao buscar métricas')
        const json = await res.json()
        if(mounted) setData(json)
      }catch(e:any){
        if(mounted) setError(e.message || 'Erro inesperado')
      }finally{
        if(mounted) setLoading(false)
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [])

  const mensPct = useMemo(() => {
    if(!data) return 0
    const meta = data.kpis.metaMensal
    if(!meta.valorMeta) return 0
    return Math.max(0, Math.min(100, (meta.realizado / meta.valorMeta) * 100))
  }, [data])

  const anualPct = useMemo(() => {
    if(!data) return 0
    const meta = data.kpis.metaAnual
    if(!meta.valorMeta) return 0
    return Math.max(0, Math.min(100, (meta.realizado / meta.valorMeta) * 100))
  }, [data])

  const lineEntregas = useMemo(() => {
    if(!data) return { labels: [], datasets: [] }
    return {
      labels: data.series.labels,
      datasets: [
        { label: 'Entregas', data: data.series.entregas, borderWidth: 2, tension: 0.3, pointRadius: 2 }
      ]
    }
  }, [data])

  const lineItens = useMemo(() => {
    if(!data) return { labels: [], datasets: [] }
    return {
      labels: data.series.labels,
      datasets: [
        { label: 'Itens', data: data.series.itens, borderWidth: 2, tension: 0.3, pointRadius: 2 }
      ]
    }
  }, [data])

  if(loading){
    return (
      
        <div className="animate-pulse grid grid-cols-12 gap-6">
          {Array.from({length:6}).map((_,i)=>(
            <div key={i} className="col-span-12 md:col-span-6 lg:col-span-4 h-40 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          ))}
          <div className="col-span-12 h-80 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="col-span-12 h-80 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
      
    )
  }

  if(error){
    return (
      
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200">
          Erro ao carregar Dashboard: {error}
        </div>
      
    )
  }

  if(!data){
    return (
      
        <div className="p-4 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
          Sem dados para exibir.
        </div>
      
    )
  }

  return (
    
      <div className="grid grid-cols-12 gap-6">
        {/* KPI: Meta mensal */}
        <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm font-medium text-neutral-500">Meta mensal</div>
          <div className="flex items-center gap-4">
            <div className="w-40 h-40">
              {/* Nosso DoughnutChart já define cutout internamente; não passe prop cutout */}
              <DoughnutChart
                data={{
                  labels: ['Realizado', 'Restante'],
                  datasets: [{ data: [mensPct, 100 - mensPct], borderWidth: 0 }]
                }}
                width={160}
                height={160}
              />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-semibold">{mensPct.toFixed(0)}%</div>
              <div className="text-neutral-500 text-sm">Progresso: {formatThousands(data.kpis.metaMensal.realizado)} de {formatThousands(data.kpis.metaMensal.valorMeta)}</div>
              <div className="text-xs">Variação vs mês anterior: <b>{(data.kpis.variacaoMensalPerc ?? 0).toFixed(1)}%</b></div>
            </div>
          </div>
        </div>

        {/* KPI: Meta anual */}
        <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm font-medium text-neutral-500">Meta anual</div>
          <div className="flex items-center gap-4">
            <div className="w-40 h-40">
              <DoughnutChart
                data={{
                  labels: ['Realizado', 'Restante'],
                  datasets: [{ data: [anualPct, 100 - anualPct], borderWidth: 0 }]
                }}
                width={160}
                height={160}
              />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-semibold">{anualPct.toFixed(0)}%</div>
              <div className="text-neutral-500 text-sm">Progresso: {formatThousands(data.kpis.metaAnual.realizado)} de {formatThousands(data.kpis.metaAnual.valorMeta)}</div>
            </div>
          </div>
        </div>

        {/* KPI: Colaboradores, Itens, Pendências */}
        <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm font-medium text-neutral-500">Colaboradores atendidos (mês)</div>
          <div className="text-2xl font-semibold">{formatThousands(data.kpis.colaboradoresAtendidos)}</div>
          <div className="text-sm mt-2 text-neutral-500">Itens entregues: <b>{formatThousands(data.kpis.itensEntregues)}</b></div>
        </div>
        <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm font-medium text-neutral-500">Pendências abertas</div>
          <div className="text-2xl font-semibold">{formatThousands(data.kpis.pendenciasAbertas)}</div>
          <div className="text-xs mt-1 text-neutral-500">Com prazo vencido: <b>{formatThousands(data.alertas.pendenciasVencidas)}</b></div>
        </div>

        {/* Série 12 meses: Entregas */}
        <div className="col-span-12 lg:col-span-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm font-medium text-neutral-500 mb-2">Entregas (últimos 12 meses)</div>
          <Line data={lineEntregas} options={{
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label(ctx){ return `${ctx.dataset.label}: ${formatThousands(Number(ctx.parsed.y||0))}` } } } },
            scales: { y: { ticks: { callback: (v: any) => formatThousands(Number(v)) } } }
          }} height={240} />
        </div>

        {/* Série 12 meses: Itens */}
        <div className="col-span-12 lg:col-span-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm font-medium text-neutral-500 mb-2">Itens entregues (últimos 12 meses)</div>
          <Line data={lineItens} options={{
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label(ctx){ return `${ctx.dataset.label}: ${formatThousands(Number(ctx.parsed.y||0))}` } } } },
            scales: { y: { ticks: { callback: (v: any) => formatThousands(Number(v)) } } }
          }} height={240} />
        </div>

        {/* Top itens no mês */}
        <div className="col-span-12 xl:col-span-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm font-medium text-neutral-500 mb-2">Top itens consumidos no mês</div>
          <ul className="space-y-2">
            {data.kpis.topItens?.length ? data.kpis.topItens.map((it) => (
              <li key={it.itemId} className="flex items-center justify-between text-sm">
                <span className="truncate">{it.nome}</span>
                <span className="font-medium">{formatThousands(it.quantidade)}</span>
              </li>
            )) : <li className="text-neutral-500 text-sm">Sem consumo no mês.</li>}
          </ul>
        </div>

        {/* Alertas */}
        <div className="col-span-12 xl:col-span-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="text-sm font-medium text-neutral-500 mb-2">Alertas</div>
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">Estoque abaixo do mínimo</div>
              <ul className="mt-1 space-y-1">
                {data.alertas.estoqueAbaixoMinimo?.length ? data.alertas.estoqueAbaixoMinimo.map((e, idx) => (
                  <li key={idx} className="text-sm text-neutral-700 dark:text-neutral-300">
                    {e.unidade} • {e.item}: <b>{formatThousands(e.quantidade)}</b> (min {formatThousands(e.minimo)})
                  </li>
                )) : <li className="text-neutral-500 text-sm">Nenhum item abaixo do mínimo.</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    
  )
}
