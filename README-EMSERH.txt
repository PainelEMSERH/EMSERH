EMSERH Frontend — pronto para deploy (gerado em 2025-10-29)

Como usar:
1) Substitua o conteúdo do seu repositório por esta pasta "emserh-frontend".
2) Faça commit & push. A Vercel publica automaticamente.
3) Garanta que existe a variável na Vercel (qualquer uma delas já basta): 
   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (você já tem) OU VITE_CLERK_PUBLISHABLE_KEY
4) Acesse /api/clerk-pk (deve exibir a chave). Depois acesse /signin.

Observação: o backend antigo deve ficar em outra pasta (ex.: "backend/") se quiser manter no repo.
Nesta entrega, a pasta "api" contém somente a função "clerk-pk.js".
