EMSERH — Clerk pronto (gerado em 2025-10-29)

Como subir:
1) Substitua o repositório por estes arquivos (GitHub Desktop).
2) Deploy automático da Vercel.
3) Teste:
   - /api/clerk-pk  -> deve retornar { publishableKey: "pk_..." }
   - /signin        -> form do Clerk
4) Sem variáveis em Produção? Acesse: /signin?pk=SEU_PUBLISHABLE_KEY

Observações:
- 'api/' contém apenas 'clerk-pk.js' + package.json (não é o backend).
- O backend ficará depois em outra pasta (ex.: 'backend/').
