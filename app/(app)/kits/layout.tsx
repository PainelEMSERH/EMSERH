import React from 'react'

export default function Layout({ children }: { children: React.ReactNode }){
  return (
    <div className="p-6">
      <div className="rounded-xl border border-border bg-panel p-6 shadow">
        {children}
      </div>
    </div>
  )
}
