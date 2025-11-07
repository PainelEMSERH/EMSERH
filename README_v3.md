
# v3 — Sem `to_regclass` (adeus `regclass`), sem JOIN e com tag

**Resolve:** erro do Prisma "Failed to deserialize column of type 'regclass'".  
**Como:** troquei toda verificação de existência de tabela para `pg_catalog.pg_class` + `pg_namespace` (retorna `boolean`).

## O que aplicar (mesmos caminhos do projeto)
- `app/api/alterdata/raw-rows2/route.ts`   → header: `x-alterdata-route: raw-rows2-nojoin-v3`
- `app/api/alterdata/raw-columns2/route.ts`→ header: `x-alterdata-route: raw-columns2-v3`
- `app/(app)/colaboradores/alterdata/page.tsx` → usa essas rotas e mostra um selo “API: …-v3”

Depois do deploy, abra a página e confira o selo **API: raw-rows2-nojoin-v3**.  
No Network, os dois endpoints devem trazer o header acima.
