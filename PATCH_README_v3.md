# Patch v3 — Corrige 404 em /signin (SPA)

Este patch adiciona **rewrites** no `vercel.json` para que qualquer rota (ex.: `/signin`, `/colaboradores`) carregue o `index.html` do Vite e o React Router assuma a navegação.

## Como aplicar
1. Copie o arquivo **`vercel.json`** para a **raiz do seu projeto** (mesmo nível do `package.json`). Substitua se pedir.
2. Faça **Commit** e **Push** pelo GitHub Desktop.
3. Abra o site novamente: `/signin` deve funcionar.

> Se preferir não mexer em rewrites, alternativa é usar `HashRouter` em vez de `BrowserRouter`. Posso te mandar esse patch também, mas as URLs ficam com `#/`.
