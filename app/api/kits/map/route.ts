import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const grouped = searchParams.get('grouped') === '1';

  // Pull raw rows
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select alterdata_funcao, epi_item, quantidade, nome_site
    from stg_epi_map
  `);

  if (!grouped) return NextResponse.json({ data: rows });

  const map = new Map<string, { funcoes: Set<string>, itens: Map<string, number> }>();
  for (const r of rows) {
    const nome = r.nome_site ?? r.alterdata_funcao ?? '—';
    if (!map.has(nome)) map.set(nome, { funcoes: new Set(), itens: new Map() });
    const bucket = map.get(nome)!;
    if (r.alterdata_funcao) bucket.funcoes.add(String(r.alterdata_funcao));
    const item = String(r.epi_item ?? 'SEM EPI');
    const qtd = r.quantidade == null ? 0 : Number(r.quantidade);
    // guard: treat "SEM EPI" quantity as 0
    const q = /sem epi/i.test(item) ? 0 : qtd;
    bucket.itens.set(item, q);
  }

  const data = Array.from(map.entries()).map(([nome_site, { funcoes, itens }]) => ({
    nome_site,
    funcoes: Array.from(funcoes).sort((a,b)=>a.localeCompare(b)),
    itens: Array.from(itens.entries()).map(([epi_item, quantidade]) => ({ epi_item, quantidade }))
      .sort((a,b)=>a.epi_item.localeCompare(b.epi_item)),
    funcoesCount: funcoes.size,
    itensCount: itens.size,
  })).sort((a,b)=>a.nome_site.localeCompare(b.nome_site));

  return NextResponse.json({ data });
}
