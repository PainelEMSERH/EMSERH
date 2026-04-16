import type { PrismaClient } from '@prisma/client';

/**
 * Garante tabela plano_acao_indicadores (mesmo esquema do import) + colunas de anexo.
 */
export async function ensurePlanoAcaoIndicadoresTable(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS plano_acao_indicadores (
      id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      item                  TEXT,
      empresa               TEXT,
      unidade               TEXT,
      diretoria             TEXT,
      gerencia              TEXT,
      cod_origem            TEXT,
      data_origem           DATE,
      origem                TEXT,
      indicador             TEXT,
      auxiliar              TEXT,
      acao                  TEXT,
      regional              TEXT,
      responsavel           TEXT,
      prazo                 DATE,
      conclusao             DATE,
      novo_prazo            DATE,
      status                TEXT,
      evidencia             TEXT,
      comentarios           TEXT,
      origem_ano            INTEGER,
      origem_mes            INTEGER,
      mes_prazo             INTEGER,
      arquivo_origem        TEXT,
      import_batch_id       TEXT,
      evidencia_arquivo_nome TEXT,
      evidencia_storage_path TEXT,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE plano_acao_indicadores ADD COLUMN IF NOT EXISTS evidencia_arquivo_nome TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE plano_acao_indicadores ADD COLUMN IF NOT EXISTS evidencia_storage_path TEXT;`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_plano_acao_regional ON plano_acao_indicadores (regional);`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_plano_acao_status ON plano_acao_indicadores (status);`,
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_plano_acao_prazo ON plano_acao_indicadores (prazo);`);
}
