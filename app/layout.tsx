import './globals.css';
import React from 'react';
import { Geist, Geist_Mono } from 'geist/font';
import Providers from './providers';

export const metadata = {
  title: 'EMSERH • EPI',
  description: 'Gestão de EPIs — Regional Sul',
};

const inter = Inter({ subsets: ['latin'], display: 'swap' });

const geistSans = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geistSans.className} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
