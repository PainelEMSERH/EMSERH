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

export async function GET() {
  try {
    const base = (catalogo as CatalogItem[]) || [];
    const extras = await getExtras();
    const all: CatalogItem[] = [...base, ...extras];

    const itemsRaw = all.map((it, idx) => {
      const nome =
        (it.descricao_site && it.descricao_site.trim()) ||
        (it.descricao_cahosp && it.descricao_cahosp.trim()) ||
        (it.codigo_pa && `Item ${it.codigo_pa.trim()}`) ||
        `Item ${idx + 1}`;

      const id =
        (it.descricao_site && it.descricao_site.trim()) ||
        (it.descricao_cahosp && it.descricao_cahosp.trim()) ||
        (it.codigo_pa && it.codigo_pa.trim()) ||
        nome;

      return { id, nome };
    });

    // Remove duplicados por id
    const seen = new Set<string>();
    const items = itemsRaw.filter((it) => {
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error('Erro em /api/estoque/items', e);
    return NextResponse.json(
      { items: [], error: e?.message ?? 'Erro interno' },
      { status: 500 },
    );
  }
}
