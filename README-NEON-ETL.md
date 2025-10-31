# EMSERH • EPI — Integração com Neon (Staging → Normalizado)

Este pacote atualiza o projeto para conectar às tabelas **stg** no Neon e popular
as tabelas normalizadas (Prisma) para uso no painel.

## O que vem aqui
- `prisma/schema.prisma` — modelos normalizados (Regionais/Unidades/Funções/Kits/Itens/Colaboradores/etc.).
- `sql/etl_from_staging.sql` — script SQL para carregar das tabelas `stg_unid_reg`, `stg_epi_map`, `stg_alterdata`.
- `lib/db.ts` — Prisma Client pronto para Next.js 14.
- `app/api/etl/sync/route.ts` — endpoint (Node runtime) para executar o ETL via servidor, se preferir.
- `.env.example` — variável `DATABASE_URL` (preencher com o Neon).

## Como usar
1. Configure a variável de ambiente do banco:
   - Copie `.env.example` para `.env.local` e preencha `DATABASE_URL` com a URL do Neon.
2. Gere as tabelas normalizadas:
   ```bash
   npx prisma migrate dev --name init
   ```
   > Se preferir controlar 100% pelo SQL, rode a migração com `psql` ou `neonctl`.
3. Carregue os dados a partir do staging:
   - Via SQL direto:
     ```bash
     psql "$DATABASE_URL" -f sql/etl_from_staging.sql
     ```
   - Ou via API (no deploy local): requisição `POST` em `/api/etl/sync`.
4. Inicie o app normalmente.

## Observações
- O script ignora `epi_item = 'SEM EPI'` ao gerar os kits.
- `matricula` do colaborador usa o **CPF** normalizado (somente dígitos) como fallback.
- Se quiser carregar **estoque inicial**, crie uma staging `stg_estoque` com colunas:
  `unidade (text)`, `item (text)`, `quantidade (int)`, `minimo (int)` e eu incluo um SQL de carga.

_Gerado em 2025-10-31T14:55:30.031394Z_
