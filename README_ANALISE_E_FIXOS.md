
# Análise do seu ZIP + Correções Cirúrgicas (Alterdata Completo)

**Confirmação de análise completa:** Revisei seu repositório que você enviou (`EMSERH-main.zip`) — rotas, página Alterdata, SQL e utilitários. Abaixo, os pontos exatos que causavam a lentidão e o recarregamento, e o que este pacote corrige **sem alterar seus filtros**.

## Causas-raiz encontradas (no seu código atual)
1. **Página carrega TUDO sempre**: `app/(app)/colaboradores/alterdata/page.tsx` chama `/api/alterdata/raw-rows` e **busca todas as páginas** (200 por página) com concorrência 10, acumulando tudo em memória.  
   - O fetch está com `{ cache: 'no-store' }` para **raw-rows** e **raw-columns**, o que **desativa** cache de CDN.  
   - Resultado: primeira carga pesada e cada nova visita também pesada.

2. **Voltar para a página recarrega tudo**: apesar de gravar em `localStorage`, o código **não lê** o cache na montagem; ou seja, sempre baixa tudo de novo, mesmo sem ter upload novo.

3. **Erro de build**: o arquivo `app/api/alterdata/import/ADD_THIS_SNIPPET.ts` contém `return` no topo e o Next compila/checa **todos** os TS, mesmo não importados. Por isso o erro:  
   > A 'return' statement can only be used within a function body.

## O que este patch faz
- **Mantém seus filtros** e a mesma lógica de Regional/Unidade (mapeada via `lib/unidReg.ts`).
- **Carregamento imediato nas revisitas**: a página agora **lê o `localStorage`** usando o `batch_id` mais recente (exposto por `/api/alterdata/raw-columns`). Se o batch não mudou, ela monta instantâneo **sem refetch**.
- **CDN cache ligada**: as rotas `raw-rows` e `raw-columns` passam a responder com `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`, e o front usa `{ cache: 'force-cache' }`. 
- **Remove o erro de build** substituindo o arquivo `ADD_THIS_SNIPPET.ts` por um **stub** inofensivo (apenas comentários).

## Arquivos deste pacote (substituir no seu projeto)
- `app/(app)/colaboradores/alterdata/page.tsx`
- `app/api/alterdata/raw-rows/route.ts`
- `app/api/alterdata/raw-columns/route.ts`
- `app/api/alterdata/import/ADD_THIS_SNIPPET.ts`

## Como aplicar
1. Faça backup do projeto.
2. Copie os arquivos para os **mesmos caminhos** no seu repo (sobrescreva).
3. Commit e deploy.

> Observação: quando você fizer um **novo upload** (import), o `batch_id` muda e a página detectará automaticamente que o cache local ficou obsoleto e fará um novo carregamento completo **apenas uma vez**. Nas próximas visitas, volta a ser instantâneo.

Se quiser, eu também insiro a invalidação por tag direto no seu `app/api/alterdata/import/route.ts` sem criar arquivos à parte (sem “snippet”).

