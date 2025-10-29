import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import ThemeProvider from './utils/ThemeContext'
import App from './App'

// Tenta VITE_, senão usa NEXT_PUBLIC_ (compatível com sua config atual na Vercel)
const pk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
if (!pk) {
  console.warn('Clerk Publishable Key não configurada (VITE_CLERK_PUBLISHABLE_KEY ou NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={pk}>
      <Router>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </Router>
    </ClerkProvider>
  </React.StrictMode>
)
