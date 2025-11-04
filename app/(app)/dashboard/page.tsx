'use client'
import NextDynamic from 'next/dynamic'

const DashboardEPI = NextDynamic(() => import('@/components/pages/DashboardEPIClient'), { ssr: false })

export const dynamic = 'force-dynamic'
export default function Page(){ return <DashboardEPI /> }
