import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import ThemeProvider from './utils/ThemeContext'
import App from './App'

function Root() {
  const [pk, setPk] = useState(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || window.__CLERK_PK__ || null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (pk) return
    // try querystring ?pk=...
    const qs = new URLSearchParams(window.location.search)
    const urlPk = qs.get('pk')
    if (urlPk) {
      setPk(urlPk)
      window.__CLERK_PK__ = urlPk
      return
    }
    // fetch from serverless
    ;(async () => {
      try {
        const r = await fetch('/api/clerk-pk')
        if (!r.ok) throw new Error('Sem chave do Clerk (configure na Vercel).')
        const j = await r.json()
        setPk(j.publishableKey)
      } catch (e) {
        setErr(e.message || 'Erro ao carregar chave do Clerk')
      }
    })()
  }, [pk])

  if (!pk) {
    return (
      <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f3f4f6',color:'#111',textAlign:'center',padding:'24px'}}>
        <div>
          <div style={{fontSize:'18px',fontWeight:600,marginBottom:'8px'}}>Carregando autenticação…</div>
          {err && <div style={{maxWidth:520,margin:'0 auto',fontSize:'14px',color:'#6b7280'}}>
            {err}<br/>Você pode abrir <code>/api/clerk-pk</code> para verificar a chave ou acessar <b>/signin?pk=SEU_PK_AQUI</b>.
          </div>}
        </div>
      </div>
    )
  }

  return (
    <ClerkProvider publishableKey={pk}>
      <Router>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </Router>
    </ClerkProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
