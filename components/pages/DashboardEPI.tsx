'use client'
import React, { useEffect, useMemo, useState } from 'react'
import Sidebar from '@/components/partials/Sidebar'
import Header from '@/components/partials/Header'
import DoughnutChart from '@/components/charts/DoughnutChart'
import LineChart01 from '@/components/charts/LineChart01'
import { formatThousands } from '@/components/utils/Utils'

type Metrics = {
  period: { year:number, month:number },
  escopo: 'regional'|'unidade',
  regionalId?: string, unidadeId?: string,
  kpis: {
    metaMensal: { valorMeta:number, realizado:number },
    metaAnual:  { valorMeta:number, realizado:number },
    variacaoMensalPerc: number,
    colaboradoresAtendidos: number,
    itensEntregues: number,
    pendenciasAbertas: number,
    pendenciasVencidas: number,
    topItens: { itemId:string, nome:string, quantidade:number }[],
  },
  series: { labels:string[], entregas:number[], itens:number[] },
  alerts: { lowStock: { item:string, unidade:string, quantidade:number, minimo:number }[], pendenciasVencidas:number }
}

function pct(a:number, b:number){ if(!b || b<=0) return 0; return Math.max(0, Math.min(100, (a/b)*100)) }

export default function DashboardEPI(){
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const today = new Date()
  const [year,setYear] = useState(today.getUTCFullYear())
  const [month,setMonth] = useState(today.getUTCMonth()+1)
  const [scope,setScope] = useState<'regional'|'unidade'>('unidade')
  const [regionalId,setRegionalId] = useState<string|undefined>(undefined)
  const [unidadeId,setUnidadeId] = useState<string|undefined>(undefined)
  const [data,setData] = useState<Metrics|undefined>()

  useEffect(()=>{
    const p = new URLSearchParams()
    p.set('escopo', scope)
    if(regionalId) p.set('regionalId', regionalId)
    if(unidadeId) p.set('unidadeId', unidadeId)
    p.set('year', String(year)); p.set('month', String(month))
    fetch(`/api/dashboard/metrics?`+p.toString()).then(r=>r.json()).then(setData).catch(()=>setData(undefined))
  },[scope,regionalId,unidadeId,year,month])

  const mensPct = useMemo(()=> pct(data?.kpis.metaMensal.realizado ?? 0, data?.kpis.metaMensal.valorMeta ?? 0), [data])
  const anuPct  = useMemo(()=> pct(data?.kpis.metaAnual.realizado ?? 0, data?.kpis.metaAnual.valorMeta ?? 0), [data])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            <div className="sm:flex sm:justify-between sm:items-center mb-8">
              <div className="mb-4 sm:mb-0">
                <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Dashboard • EPI</h1>
                <p className="text-sm text-gray-500 mt-1" aria-live="polite">Escopo: {scope.toUpperCase()}</p>
              </div>
              <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
                <label className="sr-only" htmlFor="month">Mês</label>
                <input id="month" aria-label="Mês" className="form-input px-2 py-1 rounded border" type="number" min={1} max={12} value={month} onChange={e=>setMonth(parseInt(e.target.value||'1'))}/>
                <label className="sr-only" htmlFor="year">Ano</label>
                <input id="year" aria-label="Ano" className="form-input px-2 py-1 rounded border" type="number" min={2020} max={2100} value={year} onChange={e=>setYear(parseInt(e.target.value||'2024'))}/>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-6 lg:col-span-4">
                <div className="bg-white dark:bg-gray-800 shadow rounded-2xl p-4">
                  <div className="font-semibold mb-2">Meta Mensal</div>
                  <div className="h-44">
                    <DoughnutChart data={{ labels: ['Realizado','Restante'], datasets: [{ data: [mensPct, 100-mensPct], borderWidth: 0 }] }} width={389} height={160} />
                  </div>
                  <div className="mt-3 text-sm text-gray-500">Progresso: {mensPct.toFixed(0)}% — {formatThousands(data?.kpis.metaMensal.realizado||0)} de {formatThousands(data?.kpis.metaMensal.valorMeta||0)}</div>
                  <div className="mt-1 text-xs">Variação vs mês anterior: <b>{(data?.kpis.variacaoMensalPerc ?? 0).toFixed(1)}%</b></div>
                </div>
              </div>

              <div className="col-span-12 md:col-span-6 lg:col-span-4">
                <div className="bg-white dark:bg-gray-800 shadow rounded-2xl p-4">
                  <div className="font-semibold mb-2">Meta Anual</div>
                  <div className="h-44">
                    <DoughnutChart data={{ labels: ['Realizado','Restante'], datasets: [{ data: [anuPct, 100-anuPct], borderWidth: 0 }] }} width={389} height={160} />
                  </div>
                  <div className="mt-3 text-sm text-gray-500">Progresso: {anuPct.toFixed(0)}% — {formatThousands(data?.kpis.metaAnual.realizado||0)} de {formatThousands(data?.kpis.metaAnual.valorMeta||0)}</div>
                </div>
              </div>

              <div className="col-span-12 md:col-span-6 lg:col-span-4 grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center">
                  <div className="text-xs text-gray-500">Colaboradores atendidos</div>
                  <div className="text-2xl font-semibold mt-1">{formatThousands(data?.kpis.colaboradoresAtendidos || 0)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center">
                  <div className="text-xs text-gray-500">Itens entregues</div>
                  <div className="text-2xl font-semibold mt-1">{formatThousands(data?.kpis.itensEntregues || 0)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center">
                  <div className="text-xs text-gray-500">Pendências abertas</div>
                  <div className="text-2xl font-semibold mt-1">{formatThousands(data?.kpis.pendenciasAbertas || 0)}</div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
                  <div className="flex justify-between items-center"><div className="font-semibold">Top itens do mês</div></div>
                  <ul className="mt-3 space-y-2" aria-live="polite">
                    {(data?.kpis.topItens ?? []).map((t)=> (
                      <li key={t.itemId} className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-200">{t.nome}</span>
                        <span className="font-medium">{formatThousands(t.quantidade)}</span>
                      </li>
                    ))}
                    {(data?.kpis.topItens?.length ?? 0) === 0 && <li className="text-sm text-gray-500">Sem dados no período</li>}
                  </ul>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-8">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
                  <div className="font-semibold mb-2">Últimos 12 meses</div>
                  <div role="img" aria-label="Série temporal de entregas e itens">
                    <LineChart01 data={{ labels: data?.series.labels ?? [], datasets: [
                        { data: data?.series.entregas ?? [], label: 'Entregas', fill: false, tension: 0.3 },
                        { data: data?.series.itens ?? [], label: 'Itens', fill: false, tension: 0.3 },
                      ] }} width={595} height={248} />
                  </div>
                </div>
              </div>

              <div className="col-span-12">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Alertas</div>
                    <span className="inline-flex items-center text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full" aria-live="polite">
                      Pendências vencidas: {formatThousands(data?.alerts.pendenciasVencidas || 0)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-medium mb-1">Estoque abaixo do mínimo</div>
                    <div className="overflow-x-auto">
                      <table className="table-auto w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="px-2 py-1">Unidade</th>
                            <th className="px-2 py-1">Item</th>
                            <th className="px-2 py-1">Qtd</th>
                            <th className="px-2 py-1">Mínimo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.alerts.lowStock ?? []).slice(0,8).map((r,idx)=> (
                            <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                              <td className="px-2 py-1">{r.unidade}</td>
                              <td className="px-2 py-1">{r.item}</td>
                              <td className="px-2 py-1">{formatThousands(r.quantidade)}</td>
                              <td className="px-2 py-1">{formatThousands(r.minimo)}</td>
                            </tr>
                          ))}
                          {((data?.alerts.lowStock ?? []).length === 0) && (
                            <tr><td className="px-2 py-2 text-gray-500" colSpan={4}>Sem itens abaixo do mínimo</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
