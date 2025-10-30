-- db/02_staging.sql
-- Tabelas de staging (importação direta dos CSVs do GitHub)

DROP TABLE IF EXISTS stg_alterdata;
CREATE TABLE stg_alterdata (
  cpf TEXT,
  colaborador TEXT,
  funcao TEXT,
  unidade_hospitalar TEXT,
  admissao DATE,
  demissao DATE
);

DROP TABLE IF EXISTS stg_unid_reg;
CREATE TABLE stg_unid_reg (
  nmdepartamento TEXT,
  regional_responsavel TEXT
);

DROP TABLE IF EXISTS stg_epi_map;
CREATE TABLE stg_epi_map (
  alterdata_funcao TEXT,
  epi_item TEXT,
  quantidade NUMERIC(10,2),
  nome_site TEXT
);
