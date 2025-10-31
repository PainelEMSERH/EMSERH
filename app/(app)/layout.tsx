import React from 'react';
import AppShell from '@/components/layout/AppShell';

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
