'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  ChevronRight,
  Flame,
  HardHat,
  Package,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import { formatThousands as _formatThousands } from '@/components/utils/Utils'
import DoughnutChart from '@/components/charts/DoughnutChart'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler)

type KPI = {
  metaMensal: { valorMeta: number; realizado: number }
  variacaoMensalPerc: number
  metaAnual: { valorMeta: number; realizado: number }
  colaboradoresAtendidos: number
  itensEntregues: number
  pendenciasAbertas: number
  topItens: { itemId: string; nome: string; quantidade: number }[]
}

type Series = {
  labels: string[]
  entregas: number[]
  itens: number[]
}

type Alertas = {
  estoqueAbaixoMinimo: { unidade: string; item: string; quantidade: number; minimo: number }[]
  pendenciasVencidas: number
}

type Payload = {
  kpis: KPI
  series: Series
  alertas: Alertas
}

type AcidentesStats = {
  ok: boolean
  totalAno: number
  totalMes: number
  porRegional: { regional: string; quantidade: number }[]
  porMes: Record<string, number>
  comAfastamento: number
  semAfastamento: number
}

type SpciStats = {
  ok: boolean
  stats: {
    total: number
    totalVencidos: number
    totalAVencer: number
    totalSemContrato: number
    porRegional: Record<string, number>
  }
}

type OsMetaReal = {
  ok: boolean
  meta: Record<string, number>
  metaMensal: Record<string, number>
  real: Record<string, number>
  realAcumulado: Record<string, number>
  totalColaboradores: number
  totalMeta: number
  totalReal: number
  ano: number
}

const formatThousands = (v: number) =>
  _formatThousands ? _formatThousands(v) : (v ?? 0).toLocaleString('pt-BR')

const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function healthLabel(pct: number): { text: string; className: string } {
  if (pct >= 85) return { text: 'No alvo', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25' }
  if (pct >= 60) return { text: 'Atenção', className: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500/25' }
  return { text: 'Crítico', className: 'bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-500/25' }
}

type MiniStatProps = {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  variant?: 'default' | 'warn' | 'danger'
}

function MiniStat({ icon, label, value, hint, variant = 'default' }: MiniStatProps) {
  const ring =
    variant === 'danger'
      ? 'border-red-500/20 bg-red-500/[0.06]'
      : variant === 'warn'
        ? 'border-amber-500/20 bg-amber-500/[0.06]'
        : 'border-border bg-card/80'
  return (
    <div className={`rounded-xl border px-4 py-3 ${ring} backdrop-blur-sm`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg/80 text-muted [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-text">{value}</p>
          {hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted">{hint}</p> : null}
        </div>
      </div>
    </div>
  )
}

type KpiCardProps = {
  title: string
  subtitle: string
  href: string
  hrefLabel: string
  pct: number
  doughnut: React.ReactNode
  footer: React.ReactNode
  badge: { text: string; className: string }
  accentClass: string
}

function KpiCard({ title, subtitle, href, hrefLabel, pct, doughnut, footer, badge, accentClass }: KpiCardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border bg-panel p-5 shadow-sm transition-shadow hover:shadow-md ${accentClass}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-current opacity-[0.07]" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
          <p className="mt-1 text-xs text-muted">{subtitle}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
          {badge.text}
        </span>
      </div>
      <div className="relative mt-4 flex items-center gap-4">
        <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center">{doughnut}</div>
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold tabular-nums tracking-tight text-text">{pct.toFixed(1)}%</p>
          <div className="mt-2 text-xs leading-relaxed text-muted">{footer}</div>
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {hrefLabel}
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function DashboardEPI() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [epi, setEpi] = useState<Payload | null>(null)
  const [acidentes, setAcidentes] = useState<AcidentesStats | null>(null)
  const [osMeta, setOsMeta] = useState<OsMetaReal | null>(null)
  const [spci, setSpci] = useState<SpciStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regionais, setRegionais] = useState<string[]>([])
  const [regionalSelecionada, setRegionalSelecionada] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState(0)

  const donutTrack = isDark ? 'rgba(255,255,255,0.1)' : 'rgb(228, 228, 231)'

  useEffect(() => {
    fetch('/api/entregas/options', { cache: 'force-cache' })
      .then((r) => r.json())
      .then((json) => {
        const regs = (json.regionais || []).sort()
        setRegionais(regs)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let mounted = true
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        const ano = new Date().getFullYear()
        const epiUrl = regionalSelecionada
          ? `/api/dashboard/metrics?regional=${encodeURIComponent(regionalSelecionada)}`
          : '/api/dashboard/metrics'
        const acidentesUrl =
          `/api/acidentes/stats?ano=${ano}` +
          (regionalSelecionada ? `&regional=${encodeURIComponent(regionalSelecionada)}` : '')
        const osUrl =
          `/api/ordem-servico/meta-real?ano=${ano}` +
          (regionalSelecionada ? `&regional=${encodeURIComponent(regionalSelecionada)}` : '')
        const spciUrl = '/api/spci/stats' + (regionalSelecionada ? `?regional=${encodeURIComponent(regionalSelecionada)}` : '')

        const [epiRes, acRes, osRes, spciRes] = await Promise.all([
          fetch(epiUrl, { cache: 'no-store' }),
          fetch(acidentesUrl, { cache: 'no-store' }),
          fetch(osUrl, { cache: 'no-store' }),
          fetch(spciUrl, { cache: 'no-store' }),
        ])

        if (!epiRes.ok) throw new Error('Falha ao buscar métricas de EPI')
        const epiJson = await epiRes.json()
        const acJson = acRes.ok ? await acRes.json() : null
        const osJson = osRes.ok ? await osRes.json() : null
        const spciJson = spciRes.ok ? await spciRes.json() : null

        if (!mounted) return
        setEpi(epiJson)
        setAcidentes(acJson && acJson.ok ? acJson : null)
        setOsMeta(osJson && osJson.ok !== false ? osJson : null)
        setSpci(spciJson && spciJson.ok ? spciJson : null)
      } catch (e: any) {
        if (mounted) setError(e.message || 'Erro inesperado')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => {
      mounted = false
    }
  }, [regionalSelecionada, refreshKey])

  const mensPct = useMemo(() => {
    if (!epi) return 0
    const meta = epi.kpis.metaMensal
    if (!meta.valorMeta) return 0
    return Math.max(0, Math.min(100, (meta.realizado / meta.valorMeta) * 100))
  }, [epi])

  const anualPct = useMemo(() => {
    if (!epi) return 0
    const meta = epi.kpis.metaAnual
    if (!meta.valorMeta) return 0
    return Math.max(0, Math.min(100, (meta.realizado / meta.valorMeta) * 100))
  }, [epi])

  const gridMuted = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.06)'
  const tickColor = isDark ? 'rgba(148, 163, 184, 0.9)' : 'rgba(71, 85, 105, 0.9)'

  const lineChartData = useMemo(() => {
    if (!epi) return { labels: [], datasets: [] }
    return {
      labels: epi.series.labels,
      datasets: [
        {
          label: 'Planejado',
          data: epi.series.itens,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
        },
        {
          label: 'Realizado',
          data: epi.series.entregas,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
        },
      ],
    }
  }, [epi])

  const lineChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 16,
            font: { size: 12 },
            color: tickColor,
          },
        },
        tooltip: {
          callbacks: {
            label(ctx: any) {
              return `${ctx.dataset.label}: ${formatThousands(Number(ctx.parsed.y || 0))}`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v: any) => formatThousands(Number(v)),
            font: { size: 11 },
            color: tickColor,
          },
          grid: { color: gridMuted },
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: tickColor },
        },
      },
    }),
    [gridMuted, tickColor],
  )

  const acidentesLineData = useMemo(() => {
    if (!acidentes) return { labels: [], datasets: [] }
    const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    const labels = meses.map((m) => MES_CURTO[parseInt(m, 10) - 1])
    const valores = meses.map((m) => acidentes.porMes?.[m] || 0)
    return {
      labels,
      datasets: [
        {
          label: 'Registros no mês',
          data: valores,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
        },
      ],
    }
  }, [acidentes])

  const osPct = useMemo(() => {
    if (!osMeta || !osMeta.totalMeta) return 0
    return Math.max(0, Math.min(100, (osMeta.totalReal / osMeta.totalMeta) * 100))
  }, [osMeta])

  const spciSaudavelPct = useMemo(() => {
    if (!spci || !spci.stats.total) return 0
    const ruins = spci.stats.totalVencidos + spci.stats.totalAVencer
    return Math.max(0, Math.min(100, ((spci.stats.total - ruins) / spci.stats.total) * 100))
  }, [spci])

  const variacaoCor =
    epi && epi.kpis.variacaoMensalPerc >= 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400'
  const variacaoIcon = epi && epi.kpis.variacaoMensalPerc >= 0 ? '↑' : '↓'

  const topRegionaisAcidentes = useMemo(() => {
    const list = acidentes?.porRegional || []
    return [...list].sort((a, b) => b.quantidade - a.quantidade).slice(0, 6)
  }, [acidentes])

  const maxRegional = useMemo(() => {
    return Math.max(1, ...topRegionaisAcidentes.map((r) => r.quantidade))
  }, [topRegionaisAcidentes])

  if (loading) {
    return (
      <div className="space-y-8 pb-8">
        <div className="h-36 animate-pulse rounded-2xl bg-muted/40" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl bg-muted/40" />
          <div className="h-80 animate-pulse rounded-2xl bg-muted/40" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-300/80 bg-red-50 px-5 py-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
        <p className="font-medium">Não foi possível carregar o painel</p>
        <p className="mt-1 opacity-90">{error}</p>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!epi) {
    return (
      <div className="rounded-2xl border border-amber-300/80 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        Sem dados para exibir no momento.
      </div>
    )
  }

  const epiHealth = healthLabel(mensPct)
  const osHealth = healthLabel(osPct)
  const spciHealth = healthLabel(spciSaudavelPct)

  return (
    <div className="space-y-10 pb-10">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-panel shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-blue-500/[0.05] dark:from-emerald-500/10 dark:to-blue-500/10" />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">SST • Dashboard executivo</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-text md:text-3xl">
                Saúde e Segurança no Trabalho
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                {regionalSelecionada ? (
                  <>
                    Visão filtrada para <span className="font-medium text-text">{regionalSelecionada}</span>. Compare
                    indicadores de EPI, ordens de serviço, acidentes e extintores em um só lugar.
                  </>
                ) : (
                  <>
                    Visão consolidada de <span className="font-medium text-text">todas as regionais</span>. Cada bloco
                    responde: estamos no alvo? O que precisa de ação hoje?
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:flex-col md:items-stretch lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 shadow-sm backdrop-blur">
              <HardHat className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <label htmlFor="dash-regional" className="sr-only">
                Filtrar por regional
              </label>
              <select
                id="dash-regional"
                value={regionalSelecionada}
                onChange={(e) => setRegionalSelecionada(e.target.value)}
                className="min-w-[200px] flex-1 border-0 bg-transparent text-sm font-medium text-text outline-none focus:ring-0"
              >
                <option value="">Todas as regionais</option>
                {regionais.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-text shadow-sm transition-colors hover:bg-bg"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>
      </header>

      {/* Visão rápida — números operacionais do mês */}
      <section aria-labelledby="dash-overview-heading">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted" aria-hidden />
          <h2 id="dash-overview-heading" className="text-sm font-semibold text-text">
            Visão rápida do mês
          </h2>
          <span className="text-xs text-muted">— EPI e pendências</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat
            icon={<Users />}
            label="Colaboradores (base do mês)"
            value={formatThousands(epi.kpis.colaboradoresAtendidos)}
            hint="Elegíveis para EPI obrigatório no período"
          />
          <MiniStat
            icon={<Package />}
            label="Itens entregues"
            value={formatThousands(epi.kpis.itensEntregues)}
            hint="Quantidade registrada em entregas"
          />
          <MiniStat
            icon={<ClipboardCheck />}
            label="Pendências abertas"
            value={formatThousands(epi.kpis.pendenciasAbertas)}
            hint="Acompanhe na tela de entregas"
            variant={epi.kpis.pendenciasAbertas > 0 ? 'warn' : 'default'}
          />
          <MiniStat
            icon={<AlertTriangle />}
            label="Pendências vencidas"
            value={formatThousands(epi.alertas.pendenciasVencidas || 0)}
            hint="Requer prioridade"
            variant={(epi.alertas.pendenciasVencidas || 0) > 0 ? 'danger' : 'default'}
          />
        </div>
      </section>

      {/* KPIs principais */}
      <section aria-labelledby="dash-pillars-heading">
        <h2 id="dash-pillars-heading" className="mb-1 text-sm font-semibold text-text">
          Quatro pilares do SST
        </h2>
        <p className="mb-4 text-xs text-muted">
          Percentuais facilitam comparação; use as ligações para abrir o módulo detalhado.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="EPI obrigatório"
            subtitle="Meta mensal atual"
            href="/entregas"
            hrefLabel="Abrir entregas de EPI"
            pct={mensPct}
            badge={epiHealth}
            accentClass="text-emerald-600 dark:text-emerald-500"
            doughnut={
              <DoughnutChart
                data={{
                  labels: ['Realizado', 'Restante'],
                  datasets: [
                    {
                      data: [mensPct, Math.max(0, 100 - mensPct)],
                      borderWidth: 0,
                      backgroundColor: ['rgb(16, 185, 129)', donutTrack],
                    },
                  ],
                }}
                width={88}
                height={88}
              />
            }
            footer={
              <>
                <span className={`font-medium ${variacaoCor}`}>
                  {variacaoIcon} {Math.abs(epi.kpis.variacaoMensalPerc).toFixed(1)}% vs meta
                </span>
                <span className="block text-[11px] text-muted">
                  {formatThousands(epi.kpis.metaMensal.realizado)} / {formatThousands(epi.kpis.metaMensal.valorMeta)}{' '}
                  unidades planejadas
                </span>
              </>
            }
          />

          <KpiCard
            title="Ordem de serviço"
            subtitle={`Ano ${new Date().getFullYear()} • assinatura ou termo`}
            href="/ordens-de-servico"
            hrefLabel="Abrir ordens de serviço"
            pct={osPct}
            badge={osHealth}
            accentClass="text-blue-600 dark:text-blue-400"
            doughnut={
              <DoughnutChart
                data={{
                  labels: ['Concluído', 'Pendente'],
                  datasets: [
                    {
                      data: [osPct, Math.max(0, 100 - osPct)],
                      borderWidth: 0,
                      backgroundColor: ['rgb(59, 130, 246)', donutTrack],
                    },
                  ],
                }}
                width={88}
                height={88}
              />
            }
            footer={
              osMeta ? (
                <>
                  {formatThousands(osMeta.totalReal)} de {formatThousands(osMeta.totalMeta)} colaboradores com registro
                  concluído
                </>
              ) : (
                'Sem dados de OS para o ano atual'
              )
            }
          />

          <div className="group relative overflow-hidden rounded-2xl border border-border bg-panel p-5 shadow-sm transition-shadow hover:shadow-md text-red-600 dark:text-red-500">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-current opacity-[0.07]" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Acidentes</p>
                <p className="mt-1 text-xs text-muted">Ano {new Date().getFullYear()}</p>
              </div>
              <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-500/25 dark:text-red-300">
                Registros
              </span>
            </div>
            <div className="relative mt-4 flex gap-4">
              <div className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5">
                <Flame className="h-8 w-8 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-3xl font-bold tabular-nums text-text">{formatThousands(acidentes?.totalAno || 0)}</p>
                <p className="mt-1 text-xs text-muted">Total no ano</p>
                <p className="mt-3 text-xs">
                  <span className="text-muted">Neste mês:</span>{' '}
                  <span className="font-semibold text-text">{formatThousands(acidentes?.totalMes || 0)}</span>
                </p>
                <p className="mt-1 text-xs">
                  <span className="text-muted">Com afastamento:</span>{' '}
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {formatThousands(acidentes?.comAfastamento || 0)}
                  </span>
                </p>
                <Link
                  href="/acidentes"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
                >
                  Abrir acidentes
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>

          <KpiCard
            title="SPCI • Extintores"
            subtitle="Dentro do prazo vs carteira"
            href="/spci-extintores"
            hrefLabel="Abrir SPCI / extintores"
            pct={spciSaudavelPct}
            badge={spciHealth}
            accentClass="text-violet-600 dark:text-violet-400"
            doughnut={
              <DoughnutChart
                data={{
                  labels: ['Em dia', 'Atenção'],
                  datasets: [
                    {
                      data: [spciSaudavelPct, Math.max(0, 100 - spciSaudavelPct)],
                      borderWidth: 0,
                      backgroundColor: ['rgb(139, 92, 246)', donutTrack],
                    },
                  ],
                }}
                width={88}
                height={88}
              />
            }
            footer={
              spci ? (
                <>
                  {formatThousands(
                    (spci.stats.total || 0) - (spci.stats.totalVencidos + spci.stats.totalAVencer),
                  )}{' '}
                  de {formatThousands(spci.stats.total || 0)} sem vencimento próximo
                  <span className="mt-1 block text-[11px] text-muted">
                    Vencidos: {formatThousands(spci.stats.totalVencidos)} · A vencer:{' '}
                    {formatThousands(spci.stats.totalAVencer)}
                  </span>
                </>
              ) : (
                'Sem dados de SPCI para o filtro atual'
              )
            }
          />
        </div>
      </section>

      {/* Meta anual EPI */}
      <section
        className="rounded-2xl border border-border bg-panel p-5 shadow-sm md:p-6"
        aria-labelledby="dash-annual-heading"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="dash-annual-heading" className="text-sm font-semibold text-text">
              Meta anual de EPI (obrigatórios)
            </h2>
            <p className="mt-1 text-xs text-muted">Progresso acumulado no ano corrente</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-text">{anualPct.toFixed(1)}%</p>
        </div>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
            style={{ width: `${anualPct}%` }}
            role="progressbar"
            aria-valuenow={Math.round(anualPct)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {formatThousands(epi.kpis.metaAnual.realizado)} realizados de{' '}
          {formatThousands(epi.kpis.metaAnual.valorMeta)} planejados no ano
        </p>
      </section>

      {/* Gráficos */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Gráficos de evolução">
        <div className="rounded-2xl border border-border bg-panel p-5 shadow-sm md:p-6">
          <div className="mb-1 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-text">EPI — planejado × realizado</h3>
          </div>
          <p className="text-xs text-muted">Últimos 6 meses • apenas itens obrigatórios</p>
          <div className="mt-4 h-72">
            <Line data={lineChartData} options={lineChartOptions as any} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-panel p-5 shadow-sm md:p-6">
          <div className="mb-1 flex items-center gap-2">
            <Activity className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-text">Acidentes por mês</h3>
          </div>
          <p className="text-xs text-muted">Distribuição no ano {new Date().getFullYear()}</p>
          <div className="mt-4 h-72">
            <Line data={acidentesLineData} options={lineChartOptions as any} />
          </div>
        </div>
      </section>

      {/* Complementares */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="Detalhes e alertas">
        <div className="rounded-2xl border border-border bg-panel p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-text">Itens mais entregues</h3>
          <p className="mt-1 text-xs text-muted">Top 5 no consolidado atual</p>
          <ul className="mt-4 space-y-3">
            {(epi.kpis.topItens || []).slice(0, 5).map((t, i) => {
              const max = Math.max(1, ...(epi.kpis.topItens || []).map((x) => x.quantidade))
              const w = (t.quantidade / max) * 100
              return (
                <li key={t.itemId || i}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-text">{t.nome || t.itemId}</span>
                    <span className="shrink-0 tabular-nums text-muted">{formatThousands(t.quantidade)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/70">
                    <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${w}%` }} />
                  </div>
                </li>
              )
            })}
            {(!epi.kpis.topItens || epi.kpis.topItens.length === 0) && (
              <li className="text-xs text-muted">Nenhum item em destaque para o filtro.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-text">Acidentes por regional</h3>
          <p className="mt-1 text-xs text-muted">Até 6 regionais com mais registros</p>
          <ul className="mt-4 space-y-3">
            {topRegionaisAcidentes.map((r) => {
              const w = (r.quantidade / maxRegional) * 100
              return (
                <li key={r.regional}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-text">{r.regional}</span>
                    <span className="shrink-0 tabular-nums text-muted">{formatThousands(r.quantidade)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/70">
                    <div className="h-full rounded-full bg-red-400/80" style={{ width: `${w}%` }} />
                  </div>
                </li>
              )
            })}
            {topRegionaisAcidentes.length === 0 && (
              <li className="text-xs text-muted">Sem registros ou filtro muito restrito.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-text">Como ler este painel</h3>
          <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>
                <strong className="text-text">EPI:</strong> metas consideram apenas obrigatórios; variação mensal compara
                realizado com o planejado.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span>
                <strong className="text-text">OS:</strong> objetivo é cobrir colaboradores ativos; recusa com termo conta
                como concluído no módulo de OS.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              <span>
                <strong className="text-text">Acidentes:</strong> totais e curva mensal usam o mesmo ano civil do filtro.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              <span>
                <strong className="text-text">SPCI:</strong> percentual “em dia” exclui vencidos e próximos do vencimento.
              </span>
            </li>
            {regionalSelecionada ? (
              <li className="rounded-lg bg-bg/80 px-3 py-2 text-[11px] text-text">
                Filtro ativo: <span className="font-semibold">{regionalSelecionada}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      {/* Alertas estoque */}
      <section aria-labelledby="dash-alerts-heading">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-muted" />
          <h2 id="dash-alerts-heading" className="text-sm font-semibold text-text">
            Estoque mínimo (EPI)
          </h2>
        </div>
        <div className="rounded-2xl border border-border bg-panel p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">Unidades com saldo abaixo do mínimo configurado</p>
            {epi.alertas.estoqueAbaixoMinimo?.length > 0 ? (
              <span className="inline-flex items-center rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300">
                {epi.alertas.estoqueAbaixoMinimo.length} alerta(s)
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid max-h-[320px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {epi.alertas.estoqueAbaixoMinimo?.length ? (
              epi.alertas.estoqueAbaixoMinimo.map((e, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 rounded-xl border border-red-200/80 bg-red-50/90 p-3 dark:border-red-900/40 dark:bg-red-950/25"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-red-900 dark:text-red-100">{e.unidade}</p>
                    <p className="mt-0.5 truncate text-xs text-red-800/90 dark:text-red-200/90">{e.item}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-red-700 dark:text-red-300">
                      {formatThousands(e.quantidade)}
                    </p>
                    <p className="text-[10px] text-red-600/80 dark:text-red-400/90">mín. {formatThousands(e.minimo)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50/80 py-10 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <Shield className="mb-2 h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Nenhum item abaixo do mínimo</p>
                <p className="mt-1 max-w-sm text-xs text-emerald-700/90 dark:text-emerald-300/90">
                  Quando houver risco de ruptura, o alerta aparece aqui com unidade e quantidade.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
