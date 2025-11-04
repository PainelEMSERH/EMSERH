# EMSERH • Refactor v1

Principais mudanças:
- Root layout agora é Server Component; `ClerkProvider` e `next-themes` movidos para `app/providers.tsx`.
- Tema claro/escuro refeito com `next-themes` (sem hacks de transição). `ThemeToggle` atualizado.
- `AppShell` padronizado para usar tokens (`bg-bg`, `bg-panel`, `text-text`, `border-border`) e inclui `UserButton` + `ThemeToggle` no header.
- Removidos duplicados: `postcss.config.mjs`, rotas `/signin` e `/signup` (mantidas `/sign-in` e `/sign-up`).
- Mantidos endpoints e Prisma; lembre-se de configurar `DATABASE_URL` (Neon) e chaves do Clerk no ambiente.

Como testar localmente:
```bash
pnpm i   # ou npm i
pnpm dev # ou npm run dev
```
Certifique-se de definir as variáveis no `.env`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
DATABASE_URL=postgresql://... # (Neon)
```
