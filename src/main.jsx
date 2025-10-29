import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import ThemeProvider from './utils/ThemeContext'
import App from './App'

const pk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!pk) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY não configurada')
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
