
-- SQL: Otimizações de Alterdata para Neon/Postgres
-- Execute com cautela; ajuste nomes de colunas de acordo com sua staging real.

-- Exemplo assume tabela staging "stg_alterdata_v2" (ajuste se necessário).
-- Índices recomendados nas colunas de filtro/ordenação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alterdata_v2_regional ON stg_alterdata_v2 (regional);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alterdata_v2_unidade  ON stg_alterdata_v2 (unidade);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alterdata_v2_cpf      ON stg_alterdata_v2 (cpf);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alterdata_v2_nome     ON stg_alterdata_v2 (nome);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alterdata_v2_funcao   ON stg_alterdata_v2 (funcao);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alterdata_v2_cargo    ON stg_alterdata_v2 (cargo);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alterdata_v2_situacao ON stg_alterdata_v2 (situacao);

-- (Opcional) Se usa muito "updated_at" para ordenação:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alterdata_v2_updated_at ON stg_alterdata_v2 (updated_at DESC);

-- Materialized View: somente as colunas necessárias pela UI (ajuste conforme seu layout real)
-- Benefícios: consulta mais simples e rápida + estatísticas atualizadas com ANALYZE.
-- Atualize/refresh após o import.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_alterdata_flat AS
SELECT
  id,
  regional,
  unidade,
  cpf,
  nome,
  cargo,
  funcao,
  situacao,
  admissao,
  -- adicione mais colunas realmente exibidas pela página
  updated_at
FROM stg_alterdata_v2;

CREATE INDEX IF NOT EXISTS idx_mv_alterdata_flat_regional ON mv_alterdata_flat (regional);
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_flat_unidade  ON mv_alterdata_flat (unidade);
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_flat_cpf      ON mv_alterdata_flat (cpf);
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_flat_nome     ON mv_alterdata_flat (nome);
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_flat_funcao   ON mv_alterdata_flat (funcao);
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_flat_cargo    ON mv_alterdata_flat (cargo);
CREATE INDEX IF NOT EXISTS idx_mv_alterdata_flat_situacao ON mv_alterdata_flat (situacao);

-- Dica: após o import, faça:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_alterdata_flat;
-- ANALYZE mv_alterdata_flat;
