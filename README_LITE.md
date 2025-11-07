
# Patch — Alterdata Pro (Lite, sem dependências novas)

**Objetivo:** eliminar os erros de build (“module not found”) removendo dependências externas (`zod`, `@tanstack/*`) e mantendo as otimizações de performance (paginação no servidor, cache HTTP/CDN, virtualização de linhas).

## O que este patch faz
- Substitui a validação por um **normalizador em TS** (sem `zod`).
- Reescreve a tabela virtualizada com um **virtualizador leve** próprio (sem `@tanstack/react-virtual`).
- Reescreve o cliente da página para usar **fetch + cache em memória** (sem `@tanstack/react-query`).
- Mantém paginação correta, filtros, sort e **estado persistente na URL**.
- Inclui `vercel.json` para usar `npm install` explicitamente (evita ruído do `npm ci`).

## Arquivos incluídos (substituir os existentes)
- `app/api/alterdata/paginated/route.ts`
- `app/(app)/colaboradores/alterdata/pro/AlterdataClient.tsx`
- `components/ui/DataTablePro.tsx`
- `lib/alterdata/schema.ts`
- `lib/alterdata/query.ts`
- `vercel.json` (opcional, mas recomendado)

## Como aplicar
1. Faça backup do seu repo.
2. Copie os arquivos deste pacote para os mesmos caminhos no seu projeto.
3. Commit e deploy.

> Nenhum pacote novo é necessário. O build deve compilar sem erros de “module not found”.

### Observação sobre cache
- O **cache do servidor/CDN** continua ativo (1h de `s-maxage` + `stale-while-revalidate`).
- O cache em memória do cliente evita recompras ao **voltar** na navegação, mantendo a página **instantânea**.
- Quando houver **novo upload/import**, use a invalidação por tag (`revalidateTag("alterdata")`) no seu endpoint de import.
