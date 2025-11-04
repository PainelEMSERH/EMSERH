import './globals.css';
import React from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Providers from './providers';

export const metadata = {
  title: 'EMSERH • EPI',
  description: 'Gestão de EPIs — Regional Sul',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${GeistSans.className} ${GeistMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
