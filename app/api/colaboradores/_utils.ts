export async function ensureAuxTables(prisma: any){
  // Tabelas auxiliares criadas on-demand (idempotente) sem depender de extensões
  try{
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS colaborador_vinculo (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        colaboradorId TEXT NOT NULL,
        unidadeId TEXT NOT NULL,
        inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fim TIMESTAMPTZ NULL,
        CONSTRAINT fk_cv_colab FOREIGN KEY (colaboradorId) REFERENCES colaborador(id),
        CONSTRAINT fk_cv_unid  FOREIGN KEY (unidadeId) REFERENCES unidade(id)
      );
      CREATE INDEX IF NOT EXISTS idx_cv_colab ON colaborador_vinculo(colaboradorId, inicio, fim);
    `)
  }catch(e){ /* ignore */ }
  try{
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'situacao_tipo') THEN
          CREATE TYPE situacao_tipo AS ENUM ('afastamento','ferias','licenca_maternidade','licenca_medica','outro','desligado');
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS colaborador_situacao (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        colaboradorId TEXT NOT NULL,
        tipo situacao_tipo NOT NULL,
        inicio DATE NOT NULL,
        fim DATE NULL,
        criadoEm TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_cs_colab FOREIGN KEY (colaboradorId) REFERENCES colaborador(id)
      );
      CREATE INDEX IF NOT EXISTS idx_cs_colab ON colaborador_situacao(colaboradorId, inicio, fim);
    `)
  }catch(e){ /* ignore */ }
}
