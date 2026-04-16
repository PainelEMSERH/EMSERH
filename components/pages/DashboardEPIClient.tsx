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
  Target,
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

type CurvaS = {
  labels: string[]
  mensal: number[]
  acumulado: number[]
}

type Alertas = {
  estoqueAbaixoMinimo: { unidade: string; item: string; quantidade: number; minimo: number }[]
  pendenciasVencidas: number
}

type Payload = {
  kpis: KPI
  series: Series
  curvaS?: CurvaS
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

type CipaResumo = {
  ok?: boolean
  totalMeta: number
  totalReal: number
  percentTotal?: number
  ano?: number
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

type GstCards = {
  total: { label: string; count: number; pct: number }
  no_prazo: { label: string; count: number; pct: number }
  em_atraso: { label: string; count: number; pct: number }
  concluido: { label: string; count: number; pct: number }
  atraso_reprogramado: { label: string; count: number; pct: number }
  cancelado: { label: string; count: number; pct: number }
}

type GstStats = {
  ok: boolean
  total: number
  cards: GstCards
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
      className={`group relative overflow-hidden rounded-2xl border border-border bg-panel p-5 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md ${accentClass}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-current/20" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
          <p className="mt-1 text-xs text-muted">{subtitle}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
          {badge.text}
        </span>
      </div>
      <div className="relative mt-4 flex items-center gap-4">
        <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center">{doughnut}</div>
        <div className="min-w-0 flex-1">
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-text">{pct.toFixed(1)}%</p>
          <div className="mt-2 text-[12px] leading-relaxed text-muted">{footer}</div>
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {hrefLabel}
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

type IndicatorCardProps = {
  icon: React.ReactNode
  title: string
  subtitle: string
  badge: { text: string; className: string }
  value: string
  valueLabel: string
  line1: string
  line2?: string
  href: string
  hrefLabel: string
}

function IndicatorCard({
  icon,
  title,
  subtitle,
  badge,
  value,
  valueLabel,
  line1,
  line2,
  href,
  hrefLabel,
}: IndicatorCardProps) {
  return (
    <div className="group relative flex min-h-[204px] flex-col overflow-hidden rounded-2xl border border-border bg-panel p-5 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-emerald-500/20" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg/80 text-muted [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
      </div>
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wide text-muted">{valueLabel}</p>
        <p className="mt-0.5 text-4xl font-semibold tabular-nums tracking-tight text-text">{value}</p>
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted">
        <p>{line1}</p>
        {line2 ? <p>{line2}</p> : null}
      </div>
      <div className="mt-auto pt-4">
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400">
          {hrefLabel}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
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
  const [cipa, setCipa] = useState<CipaResumo | null>(null)
  const [gst, setGst] = useState<GstStats | null>(null)
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
          '/api/ordem-servico/meta-real' +
          (regionalSelecionada ? `?regional=${encodeURIComponent(regionalSelecionada)}` : '')
        const spciUrl = '/api/spci/stats' + (regionalSelecionada ? `?regional=${encodeURIComponent(regionalSelecionada)}` : '')
        const cipaUrl =
          `/api/cipa/meta-real?ano=${ano}` +
          (regionalSelecionada ? `&regional=${encodeURIComponent(regionalSelecionada)}` : '')
        const gstUrl =
          '/api/plano-acao-indicadores/stats' +
          (regionalSelecionada ? `?regional=${encodeURIComponent(regionalSelecionada)}` : '')

        const [epiRes, acRes, osRes, spciRes, cipaRes, gstRes] = await Promise.all([
          fetch(epiUrl, { cache: 'no-store' }),
          fetch(acidentesUrl, { cache: 'no-store' }),
          fetch(osUrl, { cache: 'no-store' }),
          fetch(spciUrl, { cache: 'no-store' }),
          fetch(cipaUrl, { cache: 'no-store' }),
          fetch(gstUrl, { cache: 'no-store' }),
        ])

        if (!epiRes.ok) throw new Error('Falha ao buscar métricas de EPI')
        const epiJson = await epiRes.json()
        const acJson = acRes.ok ? await acRes.json() : null
        const osJson = osRes.ok ? await osRes.json() : null
        const spciJson = spciRes.ok ? await spciRes.json() : null
        const cipaJson = cipaRes.ok ? await cipaRes.json() : null
        const gstJson = gstRes.ok ? await gstRes.json() : null

        if (!mounted) return
        setEpi(epiJson)
        setAcidentes(acJson && acJson.ok ? acJson : null)
        setOsMeta(osJson && osJson.ok !== false ? osJson : null)
        setSpci(spciJson && spciJson.ok ? spciJson : null)
        setCipa(cipaRes.ok && cipaJson ? cipaJson : null)
        setGst(gstRes.ok && gstJson?.ok ? gstJson : null)
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

  const curvaSChartData = useMemo(() => {
    const labels =
      epi?.curvaS?.labels?.length === 12
        ? epi.curvaS.labels
        : MES_CURTO.map((_, i) => `${String(i + 1).padStart(2, '0')}/${new Date().getFullYear()}`)
    const mensal = epi?.curvaS?.mensal ?? new Array(12).fill(0)
    const acumulado = epi?.curvaS?.acumulado ?? new Array(12).fill(0)
    return {
      labels,
      datasets: [
        {
          label: 'Entregue no mês',
          data: mensal,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 2.5,
          pointHoverRadius: 4,
          fill: true,
        },
        {
          label: 'Acumulado (Curva S)',
          data: acumulado,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderWidth: 3,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: false,
        },
      ],
    }
  }, [epi])

  const curvaSOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: { usePointStyle: true, padding: 14, font: { size: 11 }, color: tickColor },
        },
        tooltip: {
          callbacks: {
            label(ctx: any) {
              const v = Number(ctx.parsed?.y ?? 0)
              return `${ctx.dataset.label}: ${formatThousands(v)} itens`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v: any) => formatThousands(Number(v)), font: { size: 11 }, color: tickColor },
          grid: { color: gridMuted },
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: tickColor, maxRotation: 0, autoSkip: false },
        },
      },
    }),
    [gridMuted, tickColor],
  )

  const acidentesLineOptions = useMemo(
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
              const y = Number(ctx.parsed?.y ?? 0)
              return `${ctx.dataset.label}: ${Math.round(y)}`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            callback: (raw: string | number) => {
              const n = typeof raw === 'number' ? raw : Number(raw)
              return Number.isFinite(n) && Number.isInteger(n) ? String(n) : ''
            },
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

  const epiYtdPct = useMemo(() => {
    if (!epi) return 0
    const m = epi.kpis.metaAnual.valorMeta
    if (!m) return 0
    return Math.max(0, Math.min(100, (epi.kpis.metaAnual.realizado / m) * 100))
  }, [epi])

  const cipaPct = useMemo(() => {
    if (!cipa || !cipa.totalMeta) return 0
    if (typeof cipa.percentTotal === 'number') return Math.min(100, Math.max(0, cipa.percentTotal))
    return Math.max(0, Math.min(100, (cipa.totalReal / cipa.totalMeta) * 100))
  }, [cipa])
  const cipaHealth = healthLabel(cipaPct)
  const gstPct = useMemo(() => {
    if (!gst?.total) return 0
    return Math.max(0, Math.min(100, (Number(gst.cards?.concluido?.count || 0) / Number(gst.total || 1)) * 100))
  }, [gst])
  const gstHealth = healthLabel(gstPct)
  const anoAtual = new Date().getFullYear()
  const acidentesHealth = healthLabel(acidentes?.totalAno ? Math.max(0, 100 - acidentes.totalAno * 2) : 100)

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
              {regionalSelecionada ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                  Visão filtrada para <span className="font-medium text-text">{regionalSelecionada}</span>.
                </p>
              ) : null}
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
            hint="Colaboradores ativos da base oficial, respeitando o filtro regional"
          />
          <MiniStat
            icon={<Package />}
            label="Itens entregues"
            value={formatThousands(epi.kpis.itensEntregues)}
            hint={`Acumulado no ano ${new Date().getFullYear()} (filtro regional aplicado)`}
          />
          <MiniStat
            icon={<Target />}
            label="CIPA executado"
            value={cipa && cipa.totalMeta > 0 ? `${cipaPct.toFixed(1)}%` : '—'}
            hint={
              cipa && cipa.totalMeta > 0
                ? `${formatThousands(cipa.totalReal)} de ${formatThousands(cipa.totalMeta)} atividades`
                : 'Sem meta CIPA no filtro atual'
            }
            variant={cipaPct >= 85 ? 'default' : cipaPct >= 60 ? 'warn' : 'danger'}
          />
          <MiniStat
            icon={<ClipboardCheck />}
            label="Ações GST concluídas"
            value={formatThousands(gst?.cards?.concluido?.count || 0)}
            hint={
              gst && gst.total > 0
                ? `${((Number(gst.cards.concluido.count) / Number(gst.total)) * 100).toFixed(1)}% do plano de ação`
                : 'Sem dados GST no filtro atual'
            }
            variant={gstPct >= 85 ? 'default' : gstPct >= 60 ? 'warn' : 'danger'}
          />
        </div>
      </section>

      {/* Indicadores principais */}
      <section aria-labelledby="dash-pillars-heading">
        <h2 id="dash-pillars-heading" className="mb-1 text-sm font-semibold text-text">
          Indicadores Estratégicos
        </h2>
        <p className="mb-4 text-xs text-muted">
          Leitura executiva padronizada para decisão rápida: status atual, número-chave e ação recomendada.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <IndicatorCard
            icon={<Shield />}
            title="EPI"
            subtitle={`Aderência mensal (${anoAtual})`}
            badge={epiHealth}
            value={`${mensPct.toFixed(1)}%`}
            valueLabel="Cumprimento"
            line1={`${formatThousands(epi.kpis.metaMensal.realizado)} de ${formatThousands(epi.kpis.metaMensal.valorMeta)} itens no mês`}
            line2={`Acumulado anual: ${epiYtdPct.toFixed(1)}%`}
            href="/entregas"
            hrefLabel="Abrir entregas de EPI"
          />

          <IndicatorCard
            icon={<FileText />}
            title="Ordem de Serviço"
            subtitle={`Conformidade anual (${anoAtual})`}
            badge={osHealth}
            value={`${osPct.toFixed(1)}%`}
            valueLabel="Conformidade"
            line1={
              osMeta
                ? `${formatThousands(osMeta.totalReal)} de ${formatThousands(osMeta.totalMeta)} colaboradores com registro`
                : 'Sem dados de OS no filtro atual'
            }
            line2={osMeta ? `Base considerada: ${formatThousands(osMeta.totalColaboradores)} colaboradores` : undefined}
            href="/ordens-de-servico"
            hrefLabel="Abrir ordens de serviço"
          />

          <IndicatorCard
            icon={<Flame />}
            title="Acidentes"
            subtitle={`Ocorrências registradas (${anoAtual})`}
            badge={acidentesHealth}
            value={formatThousands(acidentes?.totalAno || 0)}
            valueLabel="Total no ano"
            line1={`Mês atual: ${formatThousands(acidentes?.totalMes || 0)} | Com afastamento: ${formatThousands(acidentes?.comAfastamento || 0)}`}
            line2={regionalSelecionada ? `Regional filtrada: ${regionalSelecionada}` : 'Consolidado de todas as regionais'}
            href="/acidentes"
            hrefLabel="Abrir acidentes"
          />

          <IndicatorCard
            icon={<Flame />}
            title="SPCI"
            subtitle="Condição da carteira de extintores"
            badge={spciHealth}
            value={`${spciSaudavelPct.toFixed(1)}%`}
            valueLabel="Em conformidade"
            line1={
              spci
                ? `${formatThousands((spci.stats.total || 0) - (spci.stats.totalVencidos + spci.stats.totalAVencer))} de ${formatThousands(spci.stats.total || 0)} em dia`
                : 'Sem dados SPCI no filtro atual'
            }
            line2={
              spci
                ? `Vencidos: ${formatThousands(spci.stats.totalVencidos)} | A vencer: ${formatThousands(spci.stats.totalAVencer)}`
                : undefined
            }
            href="/spci-extintores"
            hrefLabel="Abrir SPCI / extintores"
          />

          <IndicatorCard
            icon={<Users />}
            title="CIPA"
            subtitle={`Execução do cronograma (${cipa?.ano ?? anoAtual})`}
            badge={cipaHealth}
            value={`${cipaPct.toFixed(1)}%`}
            valueLabel="Execução"
            line1={`${formatThousands(cipa?.totalReal || 0)} de ${formatThousands(cipa?.totalMeta || 0)} atividades realizadas`}
            line2={cipa && cipa.totalMeta > 0 ? `Saldo para concluir: ${formatThousands(Math.max(0, cipa.totalMeta - cipa.totalReal))}` : 'Sem meta CIPA no filtro atual'}
            href="/cipa"
            hrefLabel="Abrir CIPA"
          />

          <IndicatorCard
            icon={<ClipboardCheck />}
            title="Ações GST"
            subtitle="Execução do plano por status"
            badge={gstHealth}
            value={`${gstPct.toFixed(1)}%`}
            valueLabel="Concluídas"
            line1={
              gst
                ? `${formatThousands(gst.cards.concluido.count)} de ${formatThousands(gst.total)} ações concluídas`
                : 'Sem dados GST no filtro atual'
            }
            line2={
              gst
                ? `No prazo: ${formatThousands(gst.cards.no_prazo.count)} | Em atraso: ${formatThousands(gst.cards.em_atraso.count)}`
                : undefined
            }
            href="/central-acoes-gst"
            hrefLabel="Abrir Central de Ações GST"
          />
        </div>
      </section>

      {/* Meta anual EPI */}
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-panel p-5 shadow-sm md:p-6"
        aria-labelledby="dash-annual-heading"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-teal-500/[0.04]" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Meta anual</p>
            <h2 id="dash-annual-heading" className="mt-1 text-base font-semibold text-text">
              EPI obrigatórios
            </h2>
            <p className="mt-1 text-xs text-muted">
              Entregues no ano (até hoje) x meta da coorte
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Atingimento</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-text">{anualPct.toFixed(1)}%</p>
          </div>
        </div>
        <div className="relative mt-5 h-56 rounded-xl border border-border bg-card/50 p-3">
          <Line data={curvaSChartData} options={curvaSOptions as any} />
        </div>
        <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">Realizado</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text">
              {formatThousands(epi.kpis.metaAnual.realizado)}
            </p>
            <p className="mt-1 text-[11px] text-muted">itens obrigatórios entregues</p>
          </div>
          <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">Meta</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text">
              {formatThousands(epi.kpis.metaAnual.valorMeta)}
            </p>
            <p className="mt-1 text-[11px] text-muted">itens previstos para a coorte</p>
          </div>
        </div>
      </section>

      {/* Gráficos */}
      <section className="grid grid-cols-1 gap-6" aria-label="Gráficos de evolução">
        <div className="rounded-2xl border border-border bg-panel p-5 shadow-sm md:p-6">
          <div className="mb-1 flex items-center gap-2">
            <Activity className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-text">Acidentes por mês</h3>
          </div>
          <p className="text-xs text-muted">Distribuição no ano {new Date().getFullYear()}</p>
          <div className="mt-4 h-72">
            <Line data={acidentesLineData} options={acidentesLineOptions as any} />
          </div>
        </div>
      </section>

    </div>
  )
}
