# Patch: conexão com Neon + página de verificação

Arquivos incluídos:

- `src/lib/db.ts` — client do Neon usando `@neondatabase/serverless` (usa `process.env.DATABASE_URL`).
- `app/api/db-check/route.ts` — rota que retorna contagem das tabelas (staging e finais).
- `app/admin/db/page.tsx` — página para visualizar o resultado.
- `package.json.merge` — adição da dependência `@neondatabase/serverless`.
- `.env.example` — apenas referência local.

## Como aplicar

1. **Copie** os arquivos deste patch para o mesmo caminho dentro do seu repo.
2. **Garanta** que a variável `DATABASE_URL` está setada no Vercel (produção e preview).
3. Confirme a instalação da lib na build do Vercel (por conta do `package.json.merge`); se preferir, adicione manualmente `@neondatabase/serverless` nas dependências do seu `package.json`.
4. Acesse `/admin/db` logado → deve exibir os números. A rota REST é `/api/db-check`.
