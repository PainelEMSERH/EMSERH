# EMSERH • Atualização (Layout/Tema/UX)

Mudanças principais:
- `/` agora redireciona para **/dashboard** (grupo `/(app)`), eliminando o layout duplicado.
- `app/layout.tsx` é **Server Component** com `Providers` (Clerk + next-themes) e `next/font` (Inter).
- Tema claro/escuro com **next-themes**; Toggle sem flicker.
- `components/layout/AppShell.tsx` usa **tokens** (`bg-bg`, `bg-panel`, `text-text`, `border-border`) e inclui **ThemeToggle** + **<UserButton />**.
- Removidos: `components/AppShell.tsx` e `components/pages/DashboardEPI.*` (legado), rotas `/signin` e `/signup`.
- Removida duplicidade `postcss.config.mjs`. `reactStrictMode` ativado.
- `globals.css`: adicionada `.ring-ring` baseada em `--ring`.

Observações:
- Endpoints e consultas Prisma permanecem como no ZIP original (incluindo `*$queryRawUnsafe`). Recomenda-se migração para queries parametrizadas em próxima etapa, para reforço de segurança sem alterar comportamento.

Arquivos alterados: ['app/providers.tsx', 'app/layout.tsx', 'components/components/ThemeToggle.jsx', 'components/layout/AppShell.tsx', 'app/page.tsx', 'next.config.js', 'app/globals.css']
Arquivos removidos: ['components/AppShell.tsx', 'components/pages/DashboardEPI.tsx', 'app/signin', 'app/signup', 'postcss.config.mjs']
