'use client'
import React, { useState } from 'react'
import Sidebar from '@/components/partials/Sidebar'
import Header from '@/components/partials/Header'
export default function Placeholder({ title }:{ title:string }){
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main>
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
              <h1 className="text-2xl font-bold mb-2">{title}</h1>
              <p>Conteúdo em desenvolvimento.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
