# EMSERH Build Fix V5 (Tailwind v3 definitive)

Este pacote corrige os erros de build do Tailwind v4 herdados do template e garante compatibilidade **Tailwind v3**.

## O que faz
1. **Normaliza `app/globals.css`**: garante `@tailwind base/components/utilities` (v3) no topo.
2. **Remove sintaxe do Tailwind v4**: apaga `@import "tailwindcss"` e `@config "...";` em todos os `.css`.
3. **Conserta classes inválidas**: `shadow-xs` → `shadow-sm`.
4. **Converte breakpoints do v4**: `@media (width >= theme(--breakpoint-md))` → `@screen md` (ou `min-width: 768px` como fallback).
5. **Desembrulha `@layer` fora do `globals.css`**: remove `@layer { ... }` e mantém o conteúdo (evita erro “no matching @tailwind ...”).
6. **Remove imports problemáticos**: apaga `@import` de `app/additional-styles/*` e `app/styles/*` dentro do `globals.css` se existirem, eliminando padrões v4 restantes.

## Como usar
1. Coloque **todos** os arquivos deste ZIP na raiz do projeto (mesmos caminhos).
2. Commit + Push → Vercel vai rodar:
   ```
   npm install
   npm i -E tailwindcss@^3 postcss autoprefixer @neondatabase/serverless chart.js@4.4.6 react-chartjs-2@5.2.0
   node scripts/ensure-tailwind-directives.cjs
   node scripts/fix-tailwind-classes.cjs
   next build
   ```
3. O build deve finalizar sem os erros de Tailwind.

Se precisar manter algum estilo de `additional-styles`, migre o conteúdo para `app/globals.css` manualmente depois (sem `@layer`), usando utilitários do Tailwind v3.
