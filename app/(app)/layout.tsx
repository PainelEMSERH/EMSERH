import React from 'react';
import dynamic from 'next/dynamic';

// Import relativo para evitar problemas de alias '@'
const AppShell = dynamic(() => import('../../components/layout/AppShell'), { ssr: true });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
