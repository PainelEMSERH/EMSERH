'use client'
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import Link from 'next/link'

function Sidebar({ sidebarOpen, setSidebarOpen, variant = 'default' }) {
  const location = useLocation()
  const { pathname } = location
  const trigger = useRef(null)
  const sidebar = useRef(null)
  const storedSidebarExpanded = 'true'
  const [sidebarExpanded, setSidebarExpanded] = useState(storedSidebarExpanded === 'true')

  useEffect(() => {
    localStorage.setItem('sidebar-expanded', sidebarExpanded.toString())
    if (sidebarExpanded) document.querySelector('body').classList.add('sidebar-expanded')
    else document.querySelector('body').classList.remove('sidebar-expanded')
  }, [sidebarExpanded])

  useEffect(() => {
    const clickHandler = ({ target }) => {
      if (!sidebar.current || !trigger.current) return
      if (!sidebarOpen || sidebar.current.contains(target) || trigger.current.contains(target)) return
      setSidebarOpen(false)
    }
    document.addEventListener('click', clickHandler)
    return () => document.removeEventListener('click', clickHandler)
  })

  useEffect(() => {
    const keyHandler = ({ keyCode }) => {
      if (!sidebarOpen || keyCode !== 27) return
      setSidebarOpen(false)
    }
    document.addEventListener('keydown', keyHandler)
    return () => document.removeEventListener('keydown', keyHandler)
  })

  return (
    <div>
      <div className={`fixed inset-0 bg-gray-900 bg-opacity-30 z-40 lg:hidden lg:z-auto ${sidebarOpen ? '' : 'hidden'}`} aria-hidden="true" />
      <div
        id="sidebar"
        ref={sidebar}
        className={`flex flex-col absolute z-40 left-0 top-0 lg:static lg:left-auto lg:top-auto lg:translate-x-0 transform h-screen overflow-y-scroll lg:overflow-y-auto no-scrollbar w-64 lg:w-64 lg:sidebar-expanded:!w-64 2xl:!w-64 shrink-0 bg-white dark:bg-gray-900 p-4 transition-all duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-64'}`}
      >
        <div className="flex justify-between mb-10 pr-3 sm:px-2">
          <button ref={trigger} className="lg:hidden text-gray-500 hover:text-gray-400" onClick={() => setSidebarOpen(!sidebarOpen)} aria-controls="sidebar" aria-expanded={sidebarOpen}>
            <span className="sr-only">Close sidebar</span>
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M10.7 12l-5-5 1.4-1.4L14.5 12l-7.4 7.4L5.7 18z" /></svg>
          </button>
          <Link end to="/" className="block">
            <span className="text-lg font-bold">EMSERH • EPI</span>
          </Link>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xs uppercase text-gray-400 font-semibold pl-3">Geral</h3>
            <ul className="mt-3">
              <li><Link end to="/" className={({ isActive }) => `block truncate transition px-3 py-2 rounded ${isActive ? 'bg-violet-100 text-violet-600 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'}`}>Dashboard</Link></li>
              <li><Link to="/colaboradores" className={({ isActive }) => `block truncate transition px-3 py-2 rounded ${isActive ? 'bg-violet-100 text-violet-600 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'}`}>Colaboradores</Link></li>
              <li><Link to="/entregas" className={({ isActive }) => `block truncate transition px-3 py-2 rounded ${isActive ? 'bg-violet-100 text-violet-600 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'}`}>Entregas</Link></li>
              <li><Link to="/pendencias" className={({ isActive }) => `block truncate transition px-3 py-2 rounded ${isActive ? 'bg-violet-100 text-violet-600 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'}`}>Pendências</Link></li>
              <li><Link to="/estoque" className={({ isActive }) => `block truncate transition px-3 py-2 rounded ${isActive ? 'bg-violet-100 text-violet-600 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'}`}>Estoque</Link></li>
              <li><Link to="/kits" className={({ isActive }) => `block truncate transition px-3 py-2 rounded ${isActive ? 'bg-violet-100 text-violet-600 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'}`}>Kits</Link></li>
              <li><Link to="/relatorios" className={({ isActive }) => `block truncate transition px-3 py-2 rounded ${isActive ? 'bg-violet-100 text-violet-600 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'}`}>Relatórios</Link></li>
              <li><Link to="/admin" className={({ isActive }) => `block truncate transition px-3 py-2 rounded ${isActive ? 'bg-violet-100 text-violet-600 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'}`}>Admin</Link></li>
              <li><Link to="/config" className={({ isActive }) => `block truncate transition px-3 py-2 rounded ${isActive ? 'bg-violet-100 text-violet-600 dark:bg-gray-800' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'}`}>Configurações</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
