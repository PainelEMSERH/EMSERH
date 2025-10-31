'use client'
import dynamic from 'next/dynamic'

// Carrega o Dashboard apenas no cliente (sem SSR) para evitar erros como getComputedStyle no build/render do servidor.
const Dashboard = dynamic(() => import('@/components/pages/Dashboard'), { ssr: false })

export default function Page() {
  return <Dashboard />
}
