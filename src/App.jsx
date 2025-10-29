import React, { useEffect } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import './css/style.css'
import './charts/ChartjsConfig'

import Dashboard from './pages/Dashboard'

import Colaboradores from './pages/emserh/Colaboradores'
import Entregas from './pages/emserh/Entregas'
import Pendencias from './pages/emserh/Pendencias'
import Estoque from './pages/emserh/Estoque'
import Kits from './pages/emserh/Kits'
import Relatorios from './pages/emserh/Relatorios'
import Admin from './pages/emserh/Admin'
import Config from './pages/emserh/Config'

import { SignedIn, SignedOut, SignIn, SignUp, useAuth } from '@clerk/clerk-react'

function RequireAuth({ children }) {
  const { isSignedIn } = useAuth()
  if (!isSignedIn) return <Navigate to="/signin" replace />
  return children
}

export default function App() {
  const location = useLocation()

  useEffect(() => {
    document.querySelector('html').style.scrollBehavior = 'smooth'
    window.scroll({ top: 0 })
    document.querySelector('html').style.scrollBehavior = ''
  }, [location.pathname])

  return (
    <Routes>
      <Route path="/signin" element={<SignedOut><SignIn routing="path" path="/signin" /></SignedOut>} />
      <Route path="/signup" element={<SignedOut><SignUp routing="path" path="/signup" /></SignedOut>} />

      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/colaboradores" element={<RequireAuth><Colaboradores /></RequireAuth>} />
      <Route path="/entregas" element={<RequireAuth><Entregas /></RequireAuth>} />
      <Route path="/pendencias" element={<RequireAuth><Pendencias /></RequireAuth>} />
      <Route path="/estoque" element={<RequireAuth><Estoque /></RequireAuth>} />
      <Route path="/kits" element={<RequireAuth><Kits /></RequireAuth>} />
      <Route path="/relatorios" element={<RequireAuth><Relatorios /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
      <Route path="/config" element={<RequireAuth><Config /></RequireAuth>} />
    </Routes>
  )
}
