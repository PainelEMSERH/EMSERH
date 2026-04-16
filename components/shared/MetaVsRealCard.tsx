'use client'

import React from 'react'

type MetaVsRealCardProps = {
  title: string
  yearControl: React.ReactNode
  monthsShort: string[]
  metaPct: (number | null)[]
  realPct: (number | null)[]
  evolPct: (number | null)[]
  realClassName?: (idx: number) => string
  metaTitle?: (idx: number) => string
  realTitle?: (idx: number) => string
  evolTitle?: (idx: number) => string
  footerLeft: React.ReactNode
  footerRight: React.ReactNode
}

const fmtPct = (n: number) => Number(n).toFixed(2)

export default function MetaVsRealCard({
  title,
  yearControl,
  monthsShort,
  metaPct,
  realPct,
  evolPct,
  realClassName,
  metaTitle,
  realTitle,
  evolTitle,
  footerLeft,
  footerRight,
}: MetaVsRealCardProps) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {yearControl}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-20 font-bold text-sm text-text">META</div>
          <div className="flex-1 grid grid-cols-12 gap-1">
            {monthsShort.map((m, idx) => {
              const v = metaPct[idx]
              return (
                <div
                  key={m}
                  className="h-8 flex items-center justify-center text-center text-xs font-medium text-text bg-muted/30 rounded"
                  title={metaTitle ? metaTitle(idx) : undefined}
                >
                  {v == null ? '—' : `${fmtPct(v)}%`}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-20 font-bold text-sm text-emerald-600 dark:text-emerald-400">REAL</div>
          <div className="flex-1 grid grid-cols-12 gap-1">
            {monthsShort.map((m, idx) => {
              const v = realPct[idx]
              const cor = realClassName
                ? realClassName(idx)
                : v == null
                  ? 'bg-muted/30 text-muted border border-border/50'
                  : 'bg-emerald-500 text-white'
              return (
                <div
                  key={m}
                  className={`h-8 flex items-center justify-center text-center text-xs font-bold rounded ${cor}`}
                  title={realTitle ? realTitle(idx) : undefined}
                >
                  {v == null ? '—' : `${fmtPct(v)}%`}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-20 font-bold text-xs text-blue-600 dark:text-blue-400">EVOL.</div>
          <div className="flex-1 grid grid-cols-12 gap-1">
            {monthsShort.map((m, idx) => {
              const v = evolPct[idx]
              const sinal = v != null && v > 0 ? '+' : ''
              const cellClass =
                v == null
                  ? 'bg-muted/20 text-muted border border-border/40'
                  : v > 0
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : v === 0
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              return (
                <div
                  key={m}
                  className={`h-7 flex items-center justify-center text-center text-[10px] font-medium rounded ${cellClass}`}
                  title={evolTitle ? evolTitle(idx) : undefined}
                >
                  {v == null ? '—' : `${sinal}${fmtPct(v)}%`}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <div className="w-20" />
          <div className="flex-1 grid grid-cols-12 gap-1">
            {monthsShort.map((m) => (
              <div
                key={m}
                className="h-8 flex items-center justify-center px-2 rounded-lg text-[10px] font-medium text-center text-muted bg-panel border border-border"
              >
                {m}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted">
          <div>{footerLeft}</div>
          <div className="text-right">{footerRight}</div>
        </div>
      </div>
    </div>
  )
}

