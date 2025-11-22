// file: app/api/estoque/items/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import catalogo from '@/data/catalogo_sesmt.json';

type CatalogItem = {
  codigo_pa: string | null;
  descricao_cahosp: string | null;
  descricao_site: string | null;
  categoria_site: string | null;
  grupo_cahosp: string | null;
  unidade_site: string | null;
  tamanho_site: string | null;
  tamanho: string | null;
};

async function getExtras(): Promise<CatalogItem[]> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS catalogo_sesmt_extra (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        codigo_pa TEXT NULL,
        descricao_cahosp TEXT NULL,
        descricao_site TEXT NULL,
        categoria_site TEXT NULL,
        grupo_cahosp TEXT NULL,
        unidade_site TEXT NULL,
        tamanho_site TEXT NULL,
        tamanho TEXT NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT codigo_pa,
             descricao_cahosp,
             descricao_site,
             categoria_site,
             grupo_cahosp,
             unidade_site,
             tamanho_site,
             tamanho
        FROM catalogo_sesmt_extra
       ORDER BY COALESCE(descricao_site, descricao_cahosp, codigo_pa)
    `);

    return (rows || []).map((r) => ({
      codigo_pa: r.codigo_pa ?? null,
      descricao_cahosp: r.descricao_cahosp ?? null,
      descricao_site: r.descricao_site ?? null,
      categoria_site: r.categoria_site ?? null,
      grupo_cahosp: r.grupo_cahosp ?? null,
      unidade_site: r.unidade_site ?? null,
      tamanho_site: r.tamanho_site ?? null,
      tamanho: r.tamanho ?? null,
    }));
  } catch (e) {
    console.error('Erro ao carregar extras do catálogo SESMT', e);
    return [];
  }
}

async function ensureItemTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS item (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      categoria TEXT NOT NULL,
      ca TEXT NULL,
      descricao TEXT NULL,
      "unidadeMedida" TEXT NOT NULL,
      "validadeDias" INT NULL,
      ativo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_item_nome_categoria ON item (nome, categoria);
    CREATE INDEX IF NOT EXISTS idx_item_categoria ON item (categoria);
  `);
}

async function seedItensFromCatalog() {
  const base = (catalogo as CatalogItem[]) || [];
  const extras = await getExtras();
  const all: CatalogItem[] = [...base, ...extras];

  for (const it of all) {
    const nome =
      (it.descricao_site && it.descricao_site.trim()) ||
      (it.descricao_cahosp && it.descricao_cahosp.trim()) ||
      (it.codigo_pa && `Item ${it.codigo_pa.trim()}`) ||
      null;

    if (!nome) continue;

    const categoria =
      (it.categoria_site && it.categoria_site.trim()) || 'EPI';
    const unidade =
      (it.unidade_site && it.unidade_site.trim()) || 'UN';

    const meta = JSON.stringify({
      codigo_pa: it.codigo_pa ?? null,
      grupo_cahosp: it.grupo_cahosp ?? null,
      tamanho: it.tamanho_site ?? it.tamanho ?? null,
    });

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO item (id, nome, categoria, ca, descricao, "unidadeMedida", "validadeDias", ativo)
         VALUES (substr(md5(random()::text || clock_timestamp()::text), 1, 24), $1, $2, NULL, $3, $4, NULL, true)
         ON CONFLICT (nome, categoria) DO NOTHING`,
        nome,
        categoria,
        meta,
        unidade,
      );
    } catch (e) {
      console.error('Erro ao inserir item a partir do catálogo SESMT', e);
    }
  }
}

export async function GET() {
  try {
    await ensureItemTable();
    await seedItensFromCatalog();

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, nome FROM item WHERE ativo = true ORDER BY nome`,
    );

    const items = (rows || []).map((r) => ({
      id: String(r.id),
      nome: (r.nome ?? '').toString(),
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error('Erro em /api/estoque/items', e);
    return NextResponse.json(
      { items: [], error: e?.message ?? 'Erro interno' },
      { status: 500 },
    );
  }
}
