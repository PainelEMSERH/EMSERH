import React from 'react'
import AppShell from '@/components/AppShell'

export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
