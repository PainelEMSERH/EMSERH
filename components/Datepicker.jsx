'use client'
import React, { useState } from 'react'
import { format } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

/**
 * @param {{ className?: string; align?: 'left'|'right' }} props
 */
export default function Datepicker({ className = '', align = 'left' }) {
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState({ from: undefined, to: undefined })

  const label = range.from && range.to
    ? `${format(range.from, 'dd/MM/yyyy')} — ${format(range.to, 'dd/MM/yyyy')}`
    : 'Selecione o período'

  const panelPos = align === 'right' ? { right: 0 } : { left: 0 }

  return (
    <div className={className} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 11h5v5H7z"></path><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 15H5V9h14v10z"></path></svg>
        <span>{label}</span>
      </button>
      {open && (
        <div
          className="absolute z-50 mt-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow p-3"
          style={panelPos}
        >
          <DayPicker
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={setRange}
            weekStartsOn={1}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button className="px-3 py-1 rounded border text-sm" onClick={() => setRange({ from: undefined, to: undefined })}>Limpar</button>
            <button className="px-3 py-1 rounded bg-violet-600 text-white text-sm" onClick={() => setOpen(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  )
}
