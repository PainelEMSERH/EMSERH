'use client'
import dynamic from 'next/dynamic'

// Carrega o Dashboard EPI apenas no cliente (sem SSR) para evitar erros como getComputedStyle no build/render do servidor.
const DashboardEPI = dynamic(() => import('@/components/pages/DashboardEPI'), { ssr: false })

export default function Page() {
  return <DashboardEPI />
}
