-- db/01_schema.sql
-- Tabelas normalizadas do sistema (produção)

CREATE TABLE IF NOT EXISTS regional (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  sigla TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unidade (
  id SERIAL PRIMARY KEY,
  regionalId INTEGER NOT NULL REFERENCES regional(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL UNIQUE,
  sigla TEXT
);

CREATE TABLE IF NOT EXISTS funcao (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS item (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  categoria TEXT,
  unidadeMedida TEXT NOT NULL DEFAULT 'un',
  ca TEXT,
  validadeDias INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS colaborador (
  id SERIAL PRIMARY KEY,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  source TEXT NOT NULL DEFAULT 'alterdata',
  primeiroCadastroEm TIMESTAMP DEFAULT now(),
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS colaborador_vinculo (
  id SERIAL PRIMARY KEY,
  colaboradorId INTEGER NOT NULL REFERENCES colaborador(id) ON DELETE CASCADE,
  unidadeId INTEGER REFERENCES unidade(id) ON DELETE SET NULL,
  funcaoId INTEGER REFERENCES funcao(id) ON DELETE SET NULL,
  admissao DATE NOT NULL,
  demissao DATE,
  situacao TEXT NOT NULL CHECK (situacao IN ('ativo','demitido')),
  origem TEXT NOT NULL DEFAULT 'alterdata'
);
CREATE INDEX IF NOT EXISTS idx_vinculo_colab ON colaborador_vinculo(colaboradorId, admissao DESC);
CREATE INDEX IF NOT EXISTS idx_vinculo_unidade ON colaborador_vinculo(unidadeId);
CREATE INDEX IF NOT EXISTS idx_vinculo_funcao ON colaborador_vinculo(funcaoId);

CREATE TABLE IF NOT EXISTS kit (
  id SERIAL PRIMARY KEY,
  funcaoId INTEGER NOT NULL REFERENCES funcao(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kit_funcao ON kit(funcaoId);

CREATE TABLE IF NOT EXISTS kit_item (
  id SERIAL PRIMARY KEY,
  kitId INTEGER NOT NULL REFERENCES kit(id) ON DELETE CASCADE,
  itemId INTEGER NOT NULL REFERENCES item(id) ON DELETE RESTRICT,
  quantidade NUMERIC(10,2) NOT NULL CHECK (quantidade >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kititem ON kit_item(kitId, itemId);
