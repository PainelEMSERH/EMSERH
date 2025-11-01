import React from 'react'

export default function PlaceholderSection({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 shadow-sm">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-slate-300/80">{children ?? 'Conteúdo em desenvolvimento.'}</p>
      </div>
    </div>
  )
}
