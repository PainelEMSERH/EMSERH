export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./charts-color-fallback.css";

export const metadata: Metadata = {
  title: "Painel EMSERH",
  description: "Sistema de gestão EMSERH",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
