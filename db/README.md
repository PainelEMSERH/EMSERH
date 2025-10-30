# db/ — EMSERH • EPI (Neon/Postgres)

Este diretório contém **somente** o necessário para usar no GitHub e subir o banco no **Neon**.

## Pré-requisitos
- Você já colocou na raiz do repositório a pasta `data/` com:
  - `Alterdata.cleaned.csv`
  - `Alterdata_vs_EPI.cleaned.csv`
  - `Unidades_vs_Regional.cleaned.csv`
- Você já tem a `DATABASE_URL` do **Neon** (e já conectou no Vercel).

## Ordem de execução (no terminal, na raiz do repo)
> Use o `psql` localmente. Comando básico:
> `psql "$DATABASE_URL" -f <arquivo>`

1. Criar tabelas de **produção**:
   ```bash
   psql "$DATABASE_URL" -f db/01_schema.sql
   ```

2. Criar tabelas de **staging**:
   ```bash
   psql "$DATABASE_URL" -f db/02_staging.sql
   ```

3. Importar os **CSV** (lendo da pasta `./data`):
   ```bash
   psql "$DATABASE_URL" -f db/03_import.sql
   ```

4. Transformar e carregar dados nas tabelas finais:
   ```bash
   psql "$DATABASE_URL" -f db/04_transform_load.sql
   ```

5. Criar views e função de elegibilidade:
   ```bash
   psql "$DATABASE_URL" -f db/05_views.sql
   ```

## Verificações rápidas
- Regionais:
  ```sql
  SELECT * FROM regional ORDER BY id;
  ```
- Unidades x Regional:
  ```sql
  SELECT u.id, u.nome, r.nome AS regional FROM unidade u JOIN regional r ON r.id=u.regionalId LIMIT 20;
  ```
- Amostra de colaboradores:
  ```sql
  SELECT c.cpf, c.nome FROM colaborador c LIMIT 20;
  ```
- Vínculo atual:
  ```sql
  SELECT * FROM vw_colaborador_vinculo_atual LIMIT 20;
  ```

Se algo não mapear (ex.: unidade com grafia diferente), o vínculo entra com `unidadeId = NULL`. Depois podemos criar uma etapa de ajuste fino — mas sua planilha “Unidades vs Regional” já cobre as ativas, então a taxa de sucesso deve ser alta.

> Obs.: Não há nenhum arquivo extra aqui — apenas o que é para estar no GitHub.
