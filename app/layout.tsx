import './charts-color-fallback.css'
import '@/app/globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'

// Força renderização dinâmica para evitar SSG nas rotas (útil com Clerk)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'EMSERH',
  description: 'Painel EMSERH',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
