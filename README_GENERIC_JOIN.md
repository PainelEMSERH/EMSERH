
# Fix — JOIN genérico com `stg_unid_reg` (sem depender de nomes de coluna)

**Erro que você viu:**  
`Invalid prisma.$queryRawUnsafe() invocation: Raw query failed. Code: '42703'. Message: column "nmddepartamento" does not exist`

**Causa:** o SQL fazia JOIN usando colunas fixas de `stg_unid_reg` (`nmddepartamento`, `regional_responsavel`), mas no seu Neon esses nomes são diferentes.

**Solução deste patch:**  
- Troca o JOIN por uma detecção **genérica** dos campos em `stg_unid_reg` via `jsonb_each_text(to_jsonb(ur))`, priorizando chaves que contenham “UNID/DEPART/HOSP” (para unidade) e “REGIONAL/RESPONS” (para regional).  
- Assim, **qualquer** esquema de `stg_unid_reg` funciona, sem renomear colunas.
- Mantém cache de CDN e compatibilidade com `stg_alterdata_v2_raw` ou a tabela legada `stg_alterdata`.

## Arquivo para substituir
- `app/api/alterdata/raw-rows/route.ts`

Depois de copiar, é só **commitar e publicar**.
