// file: app/api/estoque/catalogo/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get('q') || '').trim();
  let items = catalogo as CatalogItem[];

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
