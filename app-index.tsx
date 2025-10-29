'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';

type Props = {
  auth?: unknown;
};

export default function AppIndex({ auth }: Props = {}) {
  const { isSignedIn } = useAuth();

  return (
    <div className="min-h-screen">
      <nav className="p-4 flex gap-4">
        <Link href="/">Início</Link>
        {!isSignedIn && <Link href="/sign-in">Entrar</Link>}
      </nav>
    </div>
  );
}
