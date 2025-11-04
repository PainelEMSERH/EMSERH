
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import AppShell from "@/components/app-shell";

export const metadata: Metadata = {
  title: "EMSERH Painel",
  description: "Gestão SSMA • Regional Sul",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html suppressHydrationWarning lang="pt-BR">
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
