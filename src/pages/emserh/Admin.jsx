import React, { useState } from 'react'
import Sidebar from '../../partials/Sidebar'
import Header from '../../partials/Header'

export default function Admin() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main>
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Admin</h1>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12">
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
                  <p>Conteúdo em construção. Esta página seguirá o layout padrão do dashboard.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
