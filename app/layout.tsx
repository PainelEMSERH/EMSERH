import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import React from 'react'

export const metadata = { title: 'EMSERH • EPI', description: 'Gestão de EPI' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body className="min-h-screen bg-gray-50 dark:bg-gray-950">{children}</body>
      </html>
    </ClerkProvider>
  )
}
