
# Patch — Fallback Robusto para Alterdata + Erros visíveis

**O que este pacote faz (com base no seu repositório):**
- As rotas `raw-rows` e `raw-columns` agora **detectam automaticamente** se você tem `stg_alterdata_v2_raw`/`stg_alterdata_v2_imports` **ou** apenas a tabela legada `stg_alterdata`. Se não achar as v2, elas **caem para a legada** sem quebrar.
- A página Alterdata mostra o **erro detalhado** retornado pela API (não só “Falha ao carregar página 1”), para facilitar diagnóstico.
- Mantém **Cache-Control** (CDN) e leitura de **localStorage** por `batch_id`, para voltar instantâneo.
- Nenhuma dependência nova.

## Arquivos (substituir nos mesmos caminhos)
- `app/api/alterdata/raw-rows/route.ts`
- `app/api/alterdata/raw-columns/route.ts`
- `app/(app)/colaboradores/alterdata/page.tsx`

## Observação
- Se você possui as tabelas v2: `stg_alterdata_v2_raw` **e** `stg_alterdata_v2_imports`, tudo segue o fluxo v2 por **batch_id**.
- Se só existe `stg_alterdata`: convertemos cada linha para JSONB (`to_jsonb(t)`) mantendo os filtros por varredura de texto em todas as colunas, assim a UI continua funcionando igual.
