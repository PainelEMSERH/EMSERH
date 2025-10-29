# Patch de Correção (Frontend) — Vercel + Clerk

O que este patch faz:
- Cria um `vercel.json` na raiz para a Vercel **instalar dependências** com `--no-frozen-lockfile` (resolve o erro do pnpm).
- Atualiza `src/main.jsx` para aceitar a chave do Clerk tanto em `VITE_CLERK_PUBLISHABLE_KEY` **quanto** em `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

## Como aplicar (GitHub Desktop)
1. Baixe e extraia o ZIP.
2. Copie o arquivo `vercel.json` para a **raiz do projeto** (mesmo nível do `package.json` do frontend).
3. Copie `src/main.jsx` para dentro da pasta `src/` do seu projeto (substitua o existente).
4. Faça **commit** e **push** no GitHub Desktop. A Vercel vai publicar automaticamente.

Pronto. Você não precisa criar nova variável na Vercel — o site vai usar a que você já tem (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).