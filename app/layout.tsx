// Root layout wrapped with ClerkProvider and forced dynamic rendering
'use client';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import React from 'react';

export const dynamic = 'force-dynamic';

const pk =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  '';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ClerkProvider
          publishableKey={pk}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}