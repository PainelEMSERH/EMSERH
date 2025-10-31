'use client'
import dynamic from 'next/dynamic'
const Dashboard = dynamic(()=>import('@/components/pages/DashboardEPI'),{ ssr:false })
export default function Page(){ return <Dashboard/> }
