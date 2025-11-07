
# Legacy endpoints v3 (drop-in)

Corrige **instantaneamente** o erro de `regclass` e remove qualquer JOIN com `stg_unid_reg` **sem mudar a página**.
Basta substituir os dois arquivos abaixo (mesmos caminhos do projeto):

- `app/api/alterdata/raw-rows/route.ts`
- `app/api/alterdata/raw-columns/route.ts`

Depois do deploy:
- No DevTools → Network, as respostas desses endpoints terão o header `x-alterdata-route: legacy-v3`.
- Se não aparecer esse header, o deploy não pegou os arquivos novos.

Mantém paginação, cache e compatibilidade com `stg_alterdata_v2_raw` ou a legada `stg_alterdata`.
