# EMSERH Build Fix v4 (Definitivo p/ Tailwind v3)
- Diretrizes do Tailwind v3 apenas no `app/globals.css` (no topo).
- Remove sintaxe v4 (`@import "tailwindcss"`, `@config "..."`).
- Corrige `shadow-xs` → `shadow-sm`.
- Desembrulha QUALQUER `@layer { ... }` em arquivos CSS que não sejam `app/globals.css` (sem depender de ordem de import).
- Remove `@tailwind` duplicado fora do `globals.css`.
- `postcss.config.js` + `tailwind.config.js` prontos.

Coloque na raiz do repo e faça commit:
- vercel.json
- postcss.config.js
- tailwind.config.js
- scripts/ensure-tailwind-directives.cjs
- scripts/fix-tailwind-classes.cjs
