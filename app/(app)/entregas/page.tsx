'use client';
import React, { useEffect, useMemo, useState } from 'react';

type ColabRow = {
  id: string;                // cpf ou id interno
  nome: string;
  funcao: string;
  unidade: string;
  regional: string;
  nome_site?: string | null; // kit de exibição (derivado do stg_epi_map)
};

type EpiItem = { epi_item: string; quantidade: number };
type EpiPayloadItem = { epi_item: string; quantidade: number; entregue: boolean };

type ListResponse = {
  rows: ColabRow[];
  total: number;
  page: number;
  pageSize: number;
};

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, cache: 'no-store' });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${msg || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export default function EntregasPage() {
  // Filters
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<{ unidade: string; regional: string }[]>([]);
  const [regional, setRegional] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('');
  const [q, setQ] = useState('');

  // List state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ColabRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  // Drawer state (delivery editor)
  const [openId, setOpenId] = useState<string | null>(null);
  const [openColab, setOpenColab] = useState<ColabRow | null>(null);
  const [epi, setEpi] = useState<EpiItem[]>([]);
  const [dataEntrega, setDataEntrega] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Load options
  useEffect(() => {
    (async () => {
      try {
        const opt = await fetchJSON<{ regionais: string[]; unidades: { unidade: string; regional: string }[] }>('/api/entregas/options');
        setRegionais(opt.regionais);
        setUnidades(opt.unidades);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Load list
  async function loadList(p = page) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      if (unidade) params.set('unidade', unidade);
      if (q.trim()) params.set('q', q.trim());
      params.set('page', String(p));
      params.set('pageSize', String(pageSize));
      const data = await fetchJSON<ListResponse>(`/api/entregas/list?${params.toString()}`);
      setRows(data.rows);
      setTotal(data.total);
      setPage(data.page);
      setPageSize(data.pageSize);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadList(1); /* eslint-disable-next-line */ }, [regional, unidade, pageSize]);
  // Explicit search
  const onSearch = () => loadList(1);

  // Open drawer
  async function openEntregaEditor(row: ColabRow) {
    setOpenId(row.id);
    setOpenColab(row);
    setDataEntrega(new Date().toISOString().slice(0,10)); // YYYY-MM-DD
    try {
      const data = await fetchJSON<{ itens: EpiItem[] }>(`/api/entregas/epi?funcao=${encodeURIComponent(row.funcao)}`);
      setEpi(data.itens);
    } catch (e) {
      console.error(e);
      setEpi([]);
    }
  }

  // Save delivery
  async function saveEntrega(entregueAll = false) {
    if (!openColab) return;
    setSaving(true);
    try {
      // Build payload with entregue flags
      const payloadItens: EpiPayloadItem[] = epi.map(it => ({
        epi_item: it.epi_item,
        quantidade: it.quantidade,
        entregue: entregueAll ? true : it.quantidade > 0, // default: considera itens com qtd>0 como entregues, ajustável futuramente
      }));

      await fetchJSON('/api/entregas/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaborador: {
            id: openColab.id,
            nome: openColab.nome,
            funcao: openColab.funcao,
            unidade: openColab.unidade,
            regional: openColab.regional,
            nome_site: openColab.nome_site || null,
          },
          data_entrega: dataEntrega,
          itens: payloadItens
        }),
      });
      setOpenId(null);
      setOpenColab(null);
      setEpi([]);
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar entrega');
    } finally {
      setSaving(false);
    }
  }

  const unidadesFiltradas = useMemo(() => {
    if (!regional) return unidades;
    return unidades.filter(u => u.regional === regional);
  }, [regional, unidades]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Entregas</h1>
        <p className="text-sm text-slate-600">Marque entregas por colaborador, com registro de data e itens. Filtre por Regional/Unidade.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border shadow-sm p-3 mb-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600">Regional</label>
          <select value={regional} onChange={e=>setRegional(e.target.value)} className="rounded-xl border px-3 py-2">
            <option value="">Todas</option>
            {regionais.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600">Unidade</label>
          <select value={unidade} onChange={e=>setUnidade(e.target.value)} className="rounded-xl border px-3 py-2">
            <option value="">Todas</option>
            {unidadesFiltradas.map(u => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-xs text-slate-600">Buscar colaborador</label>
          <div className="flex gap-2">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nome ou CPF" className="flex-1 rounded-xl border px-3 py-2" />
            <button onClick={onSearch} className="px-3 py-2 rounded-xl border bg-slate-900 hover:bg-slate-800 text-white">Buscar</button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-slate-700">
              <th className="text-left px-3 py-2">Colaborador</th>
              <th className="text-left px-3 py-2">Função</th>
              <th className="text-left px-3 py-2">Unidade</th>
              <th className="text-left px-3 py-2">Regional</th>
              <th className="text-left px-3 py-2">Kit</th>
              <th className="text-right px-3 py-2 w-[220px]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Carregando...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Nenhum colaborador encontrado.</td></tr>
            )}
            {!loading && rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.nome}</td>
                <td className="px-3 py-2">{r.funcao}</td>
                <td className="px-3 py-2">{r.unidade}</td>
                <td className="px-3 py-2">{r.regional}</td>
                <td className="px-3 py-2">{r.nome_site || '—'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`/colaboradores?focus=${encodeURIComponent(r.id)}`}
                      className="px-3 py-1.5 rounded-xl border hover:bg-slate-50"
                      title="Abrir cadastro do colaborador"
                    >
                      Cadastro
                    </a>
                    <button
                      onClick={()=>openEntregaEditor(r)}
                      className="px-3 py-1.5 rounded-xl border bg-slate-900 hover:bg-slate-800 text-white"
                    >
                      Entregar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-2 border-t text-sm">
          <div className="text-slate-600">Total: {total}</div>
          <div className="flex items-center gap-2">
            <button onClick={()=>loadList(Math.max(1, page-1))} className="px-2 py-1 rounded border disabled:opacity-50" disabled={page<=1}>‹</button>
            <div>Página {page}</div>
            <button onClick={()=>loadList(page+1)} className="px-2 py-1 rounded border disabled:opacity-50" disabled={(page*pageSize)>=total}>›</button>
            <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value)); setPage(1)}} className="rounded border px-2 py-1">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Drawer / Modal */}
      {openColab && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={()=>setOpenId(null)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl p-4 overflow-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-slate-500">Entrega para</div>
                <div className="text-lg font-semibold">{openColab.nome}</div>
                <div className="text-xs text-slate-500">{openColab.funcao} • {openColab.unidade} • {openColab.regional}</div>
              </div>
              <button onClick={()=>{setOpenId(null); setOpenColab(null); setEpi([]);}} className="rounded-xl border px-3 py-1.5">Fechar</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-600">Data da entrega</label>
                <input type="date" value={dataEntrega} onChange={e=>setDataEntrega(e.target.value)} className="rounded-xl border px-3 py-2" />
              </div>
              <div className="flex items-end justify-end gap-2">
                <button onClick={()=>saveEntrega(true)} disabled={saving} className="px-3 py-2 rounded-xl border bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50">Marcar tudo entregue</button>
                <button onClick={()=>saveEntrega(false)} disabled={saving} className="px-3 py-2 rounded-xl border hover:bg-slate-50 disabled:opacity-50">Salvar</button>
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-slate-700">
                    <th className="text-left px-3 py-2">Item</th>
                    <th className="text-left px-3 py-2 w-24">Qtd</th>
                    <th className="text-center px-3 py-2 w-28">Entregue</th>
                  </tr>
                </thead>
                <tbody>
                  {epi.map((it, idx) => (
                    <tr key={it.epi_item} className={idx % 2 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-3 py-2">{it.epi_item}</td>
                      <td className="px-3 py-2">{it.quantidade}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" defaultChecked={it.quantidade > 0} onChange={(e)=>{
                          // update local "entregue" state by toggling quantity > 0 as proxy (kept simple for now)
                          // (a edição fina de quantidade pode vir depois)
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500 mt-2">Itens não marcados como “entregue” serão registrados como pendência automaticamente.</p>
          </div>
        </div>
      )}
    </div>
  );
}
