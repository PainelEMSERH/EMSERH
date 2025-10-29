# EMSERH – Fix Clerk/Next (SSR)

Arquivos incluídos:
- `next.config.mjs` → remova `output: 'export'` (se existir) e use SSR/Edge no Vercel.
- `middleware.ts` → proteção de rotas usando Clerk (sem `protect()` do tipo errado).
- `app/layout.tsx` → `ClerkProvider` + `dynamic = 'force-dynamic'` para evitar SSG nas rotas.
- `app/_templates/protected-page-template.tsx` → modelo para páginas protegidas.

Como usar:
1. Substitua os arquivos correspondentes no seu repositório.
2. Para cada rota protegida (ex.: `app/admin/page.tsx`), adapte com base no template.
3. Confirme no Vercel que **Production/Preview** têm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`.
4. Faça novo deploy.
