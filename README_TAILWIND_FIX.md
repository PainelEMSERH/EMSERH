# Patch: Tailwind v3 (corrige erro '@tailwindcss/postcss')

Este patch força a instalação do **Tailwind CSS v3** (com `postcss` e `autoprefixer`), e adiciona a configuração padrão de `postcss.config.js` e `tailwind.config.js`.
Isso elimina o erro de build **"Cannot find module '@tailwindcss/postcss'"** no Vercel.

## Como aplicar
1. Coloque **`vercel.json`**, **`postcss.config.js`** e **`tailwind.config.js`** na **raiz do repositório** (substitua se já existir).
2. Commit + push.
3. O Vercel vai instalar as dependências (Tailwind v3) e o build deve passar.

Se você já tiver `tailwind.config.*` próprio, pode manter o seu; o importante é usar **Tailwind v3** com `postcss.config.js` usando `tailwindcss` + `autoprefixer`.
