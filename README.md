# Tailwind AutoFix v2
Este patch remove imports v4 do Tailwind no `app/globals.css` (ex.: `@import "tailwindcss";`),
remove `@config` (v4) e garante as diretivas v3 no topo. Mantém `postcss.config.js` e `tailwind.config.js` padrão.

Coloque na raiz do repositório:
- vercel.json
- postcss.config.js
- tailwind.config.js
- scripts/ensure-tailwind-directives.cjs
