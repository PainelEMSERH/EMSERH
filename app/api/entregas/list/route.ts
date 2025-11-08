export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const regional = url.searchParams.get('regional') || '';
  const unidade  = url.searchParams.get('unidade')  || '';
  const q        = url.searchParams.get('q')        || '';
  const page     = url.searchParams.get('page')     || '1';
  const pageSize = url.searchParams.get('pageSize') || '25';

  try {
    const base = new URL(req.url);
    const alt = new URL('/api/alterdata/raw-rows', base.origin);
    alt.searchParams.set('regional', regional);
    alt.searchParams.set('unidade', unidade);
    alt.searchParams.set('q', q);
    alt.searchParams.set('page', page);
    alt.searchParams.set('pageSize', pageSize);

    const r = await fetch(alt.toString(), { cache: 'no-store' });
    const data = await r.json();

    const rows = (data?.rows || []).map((it: any) => ({
      id: String(it.cpf ?? it.id ?? ''),
      nome: String(it.nome ?? ''),
      funcao: String(it.funcao ?? ''),
      unidade: String(it.unidade ?? ''),
      regional: String(it.regional ?? ''),
      nome_site: null,
    }));

    return NextResponse.json({
      rows,
      total: Number(data?.total ?? rows.length),
      page: Number(page),
      pageSize: Number(pageSize),
      source: 'mirror_raw_rows'
    });
  } catch (e: any) {
    return NextResponse.json({
      rows: [],
      total: 0,
      page: Number(page),
      pageSize: Number(pageSize),
      error: e?.message || String(e),
      source: 'mirror_error'
    });
  }
}