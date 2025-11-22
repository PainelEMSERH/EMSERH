// file: app/api/estoque/catalogo/route.ts
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

async function ensureExtrasTable() {
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
}

async function loadExtras(): Promise<CatalogItem[]> {
  try {
    await ensureExtrasTable();
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get('q') || '').trim();

  let items: CatalogItem[] = (catalogo as CatalogItem[]) || [];
  const extras = await loadExtras();
  items = [...items, ...extras];

  if (qRaw) {
    const q = qRaw.toUpperCase();
    items = items.filter((it) => {
      const codigo = (it.codigo_pa || '').toUpperCase();
      const descSite = (it.descricao_site || '').toUpperCase();
      const descCahosp = (it.descricao_cahosp || '').toUpperCase();
      return (
        codigo.includes(q) ||
        descSite.includes(q) ||
        descCahosp.includes(q)
      );
    });
  }

  return NextResponse.json({ items: items.slice(0, 50) });
}

export async function POST(req: Request) {
  try {
    await ensureExtrasTable();
    const body = await req.json();

    const codigo_pa =
      (body?.codigo_pa || body?.codigoPa || '').toString().trim() || null;
    const descricao_site =
      (body?.descricao_site || body?.descricaoSite || body?.descricao || '').toString().trim();
    const descricao_cahosp =
      (body?.descricao_cahosp || body?.descricaoCahosp || '').toString().trim() || null;
    const categoria_site =
      (body?.categoria_site || body?.categoriaSite || '').toString().trim() || 'EPI';
    const grupo_cahosp =
      (body?.grupo_cahosp || body?.grupoCahosp || '').toString().trim() || null;
    const unidade_site =
      (body?.unidade_site || body?.unidadeSite || '').toString().trim() || 'UN';
    const tamanho_site =
      (body?.tamanho_site || body?.tamanhoSite || '').toString().trim() || null;
    const tamanho =
      (body?.tamanho || '').toString().trim() || tamanho_site;

    if (!descricao_site && !descricao_cahosp) {
      return NextResponse.json(
        { ok: false, error: 'Descrição obrigatória' },
        { status: 400 },
      );
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO catalogo_sesmt_extra (
         codigo_pa,
         descricao_cahosp,
         descricao_site,
         categoria_site,
         grupo_cahosp,
         unidade_site,
         tamanho_site,
         tamanho
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      codigo_pa,
      descricao_cahosp,
      descricao_site || descricao_cahosp,
      categoria_site,
      grupo_cahosp,
      unidade_site,
      tamanho_site,
      tamanho,
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em POST /api/estoque/catalogo', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Erro interno' },
      { status: 500 },
    );
  }
}
