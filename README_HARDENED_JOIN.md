
# Hardened JOIN + Diagnóstico

Este pacote elimina qualquer referência a colunas fixas como `nmddepartamento`/`regional_responsavel` e adiciona uma rota de diagnóstico para você verificar o esquema do `stg_unid_reg` no seu Neon.

## O que substituir / adicionar
- **Substituir:** `app/api/alterdata/raw-rows/route.ts`
- **Adicionar (opcional p/ diagnosticar):** `app/api/alterdata/diag/unid-reg/route.ts`  
  ➜ Depois do deploy, acesse `/api/alterdata/diag/unid-reg` para ver colunas e uma amostra da sua tabela.

## Como o JOIN funciona agora
- Usa `jsonb_each_text(to_jsonb(ur))` para **descobrir** a coluna de unidade (chave contendo `UNID`/`DEPART`/`HOSP`) e de regional (`REGIONAL`/`RESPONS`), por **linha**.
- Normaliza comparações com `regexp_replace(upper(...))`, evitando divergência por acentos/espaços.

Sem dependências novas. Cache/CDN mantido.
