'use client'
import dynamic from 'next/dynamic'

const DashboardEPI = dynamic(() => import('@/components/pages/DashboardEPIClient'), { ssr: false })

export const dynamic = 'force-dynamic'
export default function Page(){ return <DashboardEPI /> }
