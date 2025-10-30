EMSERH — Patch de Build (Vercel) + Tailwind v3
==============================================

O que tem aqui
--------------
1) `vercel.json` – força o Vercel a instalar Tailwind v3/PostCSS/Autoprefixer e compilar com `next build`.
2) `tailwind.config.cjs` – configuração Tailwind v3 (com plugin de forms).
3) `postcss.config.js` – PostCSS padrão.
4) `app/globals.css` – refeito em sintaxe do Tailwind v3 (remove `layer()` e `@plugin` do v4).
5) `app/additional-styles/utility-patterns.css` – refeito em v3; remove classes inexistentes (ex.: `shadow-xs`) e tokens `theme(--breakpoint-*)`.
   Também há cópias em `app/styles/...` para cobrir caminhos diferentes que existiam no projeto original.

Como aplicar
------------
- Extraia este ZIP na raiz do repositório (substitua os arquivos existentes).
- Faça um commit e deploy no Vercel.
- Não é necessário alterar nada na UI do Vercel; o `vercel.json` já define o comando de build.
