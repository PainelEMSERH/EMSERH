APLICAÇÃO: EMSERH — DROP-IN FIX V2

O que vem no ZIP
- middleware.ts  → substitui na raiz do projeto
- app/layout.tsx → substitui o atual (raiz da pasta app/)

Por que isso resolve
- Força renderização dinâmica (evita que o Next tente pré‑renderizar /admin, /estoque etc. e quebre com Clerk fora de contexto).
- Garante que o app inteiro esteja dentro do <ClerkProvider> na produção.
- Middleware protege as rotas sem usar o método "protect" (que estava quebrando o build pelas tipagens).

Como aplicar (sem editar nada dentro de arquivo):
1) Extraia o ZIP.
2) Copie `middleware.ts` para a raiz do repositório e substitua o existente.
3) Copie `app/layout.tsx` para `app/` e substitua o existente.
4) Commit + Deploy no Vercel.

Se ainda aparecer tela branca:
- Abra o console do navegador. Se o erro NÃO for do Clerk, me envie o print do console.
- Se for do Clerk, é quase sempre chave errada ou página tentando usar hook de Clerk fora do client. Esse layout já cobre o provider.
