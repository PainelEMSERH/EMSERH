Patch aplicado automaticamente para corrigir o build no Vercel:

    1) package.json
       - Adicionados às dependencies: typescript, @types/react, @types/node
       - Adicionados (se faltavam): @neondatabase/serverless, chart.js, react-chartjs-2
       - Dev deps para Tailwind v3: tailwindcss, postcss, autoprefixer, @tailwindcss/forms
       - Garantidos scripts: dev/build/start

    2) Tailwind v3
       - Criados/normalizados: tailwind.config.js e postcss.config.js
       - app/globals.css: inseridos @tailwind base/components/utilities; removidos imports e diretivas incompatíveis (Tailwind v4).

    3) vercel.json
       - Simplificado para usar: installCommand "npm install" e buildCommand "next build".

    4) Segurança
       - Arquivos CSS problemáticos renomeados para .bak se presentes:
         app/additional-styles/utility-patterns.css -> app/additional-styles/utility-patterns.css.bak
app/styles/additional-styles/utility-patterns.css -> app/styles/additional-styles/utility-patterns.css.bak
app/styles/utility-patterns.css -> app/styles/utility-patterns.css.bak

    5) Arquivos ajustados
       - app/globals.css

    Observação: Caso prefira Tailwind v4 no futuro, podemos migrar todas as sintaxes e plugins. Por ora padronizamos no v3 para garantir build estável no Vercel.