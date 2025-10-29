import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import ThemeProvider from './utils/ThemeContext'
import App from './App'

function Root() {
  const [pk, setPk] = useState(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || null)

  useEffect(() => {
    if (pk) return
    async function load() {
      try {
        const r = await fetch('/api/clerk-pk')
        const j = await r.json()
        setPk(j.publishableKey)
      } catch (e) {
        console.error('Erro buscando chave do Clerk', e)
      }
    }
    load()
  }, [pk])

  if (!pk) {
    return <div style={{display:'grid',placeItems:'center',height:'100vh',color:'#6b7280'}}>Carregando…</div>
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
