
# Patch — Remoção total de JOIN com `stg_unid_reg` (no-join-v1)

**Problema visto:** erro 42703 com coluna `nmddepartamento` — isso vem de JOIN no backend.
**Solução:** esta rota remove QUALQUER referencia ao `stg_unid_reg`. O filtro de Regional fica 100% no **cliente** (a sua página já mapeia `regional` por unidade).

## O que substituir
- `app/api/alterdata/raw-rows/route.ts`

Após publicar, confira no Network tab da página:
- a resposta de `/api/alterdata/raw-rows` virá com o header `x-alterdata-route: no-join-v1`.
Se o header não aparecer, o deploy não pegou o arquivo novo.

Mantém paginação, cache de CDN e compatibilidade com `stg_alterdata_v2_raw` ou `stg_alterdata`.
