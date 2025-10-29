
-- EMSERH EPI — Schema base (Neon/Postgres)

CREATE TABLE IF NOT EXISTS regional (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS unidade (
  id SERIAL PRIMARY KEY,
  regional_id INT NOT NULL REFERENCES regional(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  codigo TEXT,
  UNIQUE (regional_id, nome)
);

CREATE TABLE IF NOT EXISTS funcao (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS epi_item (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT,
  ca_numero TEXT,
  fabricante TEXT,
  tamanho_padrao TEXT,
  vida_util_meses INT
);

CREATE TABLE IF NOT EXISTS kit_funcao (
  id SERIAL PRIMARY KEY,
  funcao_id INT NOT NULL REFERENCES funcao(id) ON DELETE CASCADE,
  nome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kit_item (
  id SERIAL PRIMARY KEY,
  kit_funcao_id INT NOT NULL REFERENCES kit_funcao(id) ON DELETE CASCADE,
  epi_item_id INT NOT NULL REFERENCES epi_item(id),
  quantidade INT NOT NULL CHECK (quantidade > 0)
);

CREATE TABLE IF NOT EXISTS colaborador (
  id SERIAL PRIMARY KEY,
  cpf TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  matricula TEXT,
  funcao_id INT REFERENCES funcao(id),
  unidade_id INT REFERENCES unidade(id),
  status TEXT DEFAULT 'ativo',
  alterdata_id TEXT,
  origem_dados TEXT DEFAULT 'manual',
  dt_admissao DATE
);
