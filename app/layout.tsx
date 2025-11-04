import './globals.css';
import React from 'react';
import Providers from './providers';
import { Inter } from 'next/font/google';

export const metadata = {
  title: 'EMSERH • EPI',
  description: 'Gestão de EPIs — Regional Sul',
};

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
