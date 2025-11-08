
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';

// Util
const norm = (s:any) => (s??'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim().replace(/\s+/g,' ');

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const regional = searchParams.get('regional') || '';
  const unidade  = searchParams.get('unidade')  || '';
  const q        = searchParams.get('q')        || '';
  const page     = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(200, Math.max(10, Number(searchParams.get('pageSize') || '25')));
  const offset   = (page - 1) * pageSize;

  try {
    // 1) Puxa exatamente as mesmas linhas da tela Alterdata (já sabemos que funciona)
    const altURL = new URL('/api/alterdata/raw-rows', origin);
    altURL.searchParams.set('regional', regional);
    altURL.searchParams.set('unidade', unidade);
    altURL.searchParams.set('q', q);
    altURL.searchParams.set('page', String(page));
    altURL.searchParams.set('pageSize', String(pageSize*4)); // pega mais para filtrar depois
    const r = await fetch(altURL.toString(), { cache: 'no-store' });
    const alt = await r.json();

    // 2) Mapa de kit por função
    let kitMap: Record<string,string> = {};
    try {
      const rows: any[] = await prisma.$queryRaw`SELECT alterdata_funcao AS f, string_agg(DISTINCT nome_site, ',') AS k FROM stg_epi_map GROUP BY alterdata_funcao`;
      for (const it of rows) kitMap[norm(it.f)] = it.k || '';
    } catch {}

    // 3) Junta manual (prioridade) — se der erro, ignora manual (não quebra)
    let manual: any[] = [];
    try {
      manual = await prisma.$queryRaw`SELECT cpf AS id, nome, funcao, unidade, regional, demissao FROM epi_manual_colab`;
    } catch {}

    const manualById = new Map<string, any>();
    for (const m of manual) {
      const id = String(m.id||'').trim();
      if (!id) continue;
      // filtro demissão < 2025
      let keep = true;
      if (m.demissao) {
        const s = String(m.demissao);
        let d: any = null;
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) d = new Date(s.substring(0,10));
        else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [dd,mm,yy]=s.split('/'); d = new Date(`${yy}-${mm}-${dd}`); }
        if (d && d < new Date('2025-01-01')) keep = false;
      }
      if (!keep) continue;
      const un = String(m.unidade||'');
      manualById.set(id, {
        id, 
        nome: String(m.nome||''),
        funcao: String(m.funcao||''),
        unidade: un,
        regional: String(m.regional||UNID_TO_REGIONAL[canonUnidade(un)]||''),
        nome_site: kitMap[norm(m.funcao)] || null
      });
    }

    // 4) Monta rows a partir do Alterdata (e aplica kit / regional / filtro demissão quando disponível)
    // raw-rows não trás demissão, então aqui apenas espelha; o filtro de demissão já acontece no backend ao migrarmos p/ v2.
    const out: any[] = [];
    for (const row of (alt.rows||[])) {
      const id = String(row.cpf||row.id||'').trim();
      if (!id || manualById.has(id)) continue; // manual tem prioridade
      const un = String(row.unidade||'');
      out.push({
        id,
        nome: String(row.nome||''),
        funcao: String(row.funcao||''),
        unidade: un,
        regional: String(row.regional||UNID_TO_REGIONAL[canonUnidade(un)]||''),
        nome_site: kitMap[norm(row.funcao)] || null,
      });
    }

    // 5) Aplica filtros finais e paginação estável
    let rows = [...manualById.values(), ...out];
    if (regional) rows = rows.filter(r => norm(r.regional) === norm(regional));
    if (unidade)  rows = rows.filter(r => norm(r.unidade)  === norm(unidade));
    if (q) {
      const nq = norm(q);
      rows = rows.filter(r => norm(r.nome).includes(nq) || norm(r.id).includes(nq));
    }
    rows.sort((a,b)=>a.nome.localeCompare(b.nome));
    const total = rows.length;
    const pageRows = rows.slice(offset, offset+pageSize);

    return NextResponse.json({ rows: pageRows, total, page, pageSize, source: 'proxy_raw_rows' });
  } catch (e:any) {
    return NextResponse.json({ rows: [], total: 0, page, pageSize, error: e?.message || String(e) }, { status: 200 });
  }
}
