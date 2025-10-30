# Tailwind AutoFix Patch
Coloque estes arquivos na raiz do repo e faça commit:
- vercel.json
- postcss.config.js
- tailwind.config.js
- scripts/ensure-tailwind-directives.cjs

Durante o build no Vercel, o script garante que `app/globals.css` tenha as diretivas do Tailwind v3 no topo. Isso resolve o erro `@layer base is used but no matching @tailwind base`.
