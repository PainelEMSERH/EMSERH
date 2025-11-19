'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string; nome_site?: string | null; };
type KitItem = { item: string; quantidade: number; nome_site?: string | null; };
type Deliver = { item: string; qty_delivered: number; qty_required: number; deliveries: Array<{date:string, qty:number}>; };

const LS_KEY = 'entregas:v2025-11-07';
const LS_LIST_KEY = 'entregas:list-cache:v2025-11-19';

function maskCPF(cpf?: string) {
  const d = String(cpf || '').replace(/\D/g, '').padStart(11, '0').slice(-11);
  return d ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : '';
}

function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [state]);
  return [state, setState] as const;
}

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function EntregasPage() {
  const [state, setState] = usePersistedState(LS_KEY, {
    regional: '',
    unidade: '',
    q: '',
    page: 1,
    pageSize: 25,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidadesAll, setUnidadesAll] = useState<Array<{ unidade: string; regional: string }>>([]);

  const [modal, setModal] = useState<{ open: boolean; row?: Row | null }>({ open: false });
  const [kit, setKit] = useState<KitItem[]>([]);
  const [deliv, setDeliv] = useState<Deliver[]>([]);
  const [deliverForm, setDeliverForm] = useState<{ item: string; qtd: number; data: string }>({ item: '', qtd: 1, data: new Date().toISOString().substring(0, 10) });

  // ---- CADASTRO MANUAL (DECLARADO ANTES DO JSX) ----
  const [newColab, setNewColab] = useState<{ cpf: string; nome: string; funcao: string; unidade: string; regional: string; matricula?: string; admissao?: string; demissao?: string }>({ cpf: '', nome: '', funcao: '', unidade: '', regional: '' });
  const [modalNew, setModalNew] = useState(false);

  function openNewManual() {
    setNewColab({ cpf: '', nome: '', funcao: '', unidade: state.unidade || '', regional: state.regional || '' });
    setModalNew(true);
  }

  async function saveNewManual() {
    const body: any = { ...newColab };
    body.cpf = String(body.cpf || '').replace(/\D/g, '').slice(-11);
    const { json } = await fetchJSON('/api/entregas/manual', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    if (json?.ok) {
      setModalNew(false);
      // reload list
      const params = new URLSearchParams();
      params.set('regional', state.regional);
      if (state.unidade) params.set('unidade', state.unidade);
      if (state.q) params.set('q', state.q);
      params.set('page', String(state.page));
      params.set('pageSize', String(state.pageSize));
      const { json: j2 } = await fetchJSON('/api/entregas/list?' + params.toString(), { cache: 'no-store' });
      setRows((j2.rows || []) as Row[]);
      setTotal(Number(j2.total || 0));
    }
  }
  // ---------------------------------------------------

  const unidades = useMemo(() => unidadesAll.filter(u => !state.regional || u.regional === state.regional), [unidadesAll, state.regional]);

  useEffect(() => {
    let on = true;
    (async () => {
      const { json } = await fetchJSON('/api/entregas/options', { cache: 'force-cache' });
      if (!on) return;
      setRegionais(json.regionais || []);
      setUnidadesAll(json.unidades || []);
    })();
    return () => { on = false };
  }, []);

  useEffect(() => {
    let on = true;
    (async () => {
      if (!state.regional) { setRows([]); setTotal(0); return; }

      const key = JSON.stringify({
        regional: state.regional,
        unidade: state.unidade || '',
        q: state.q || '',
        page: state.page,
        pageSize: state.pageSize,
      });

      let hadCached = false;
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(LS_LIST_KEY);
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached && cached.key === key && Array.isArray(cached.rows)) {
              setRows(cached.rows as Row[]);
              setTotal(Number(cached.total || 0));
              hadCached = true;
            }
          }
        } catch {}
      }

      if (!hadCached) setLoading(true);

      const params = new URLSearchParams();
      params.set('regional', state.regional);
      if (state.unidade) params.set('unidade', state.unidade);
      if (state.q) params.set('q', state.q);
      params.set('page', String(state.page));
      params.set('pageSize', String(state.pageSize));
      const { json } = await fetchJSON('/api/entregas/list?' + params.toString(), { cache: 'no-store' });
      if (!on) return;

      const rows = (json.rows || []) as Row[];
      const total = Number(json.total || 0);
      setRows(rows);
      setTotal(total);
      setLoading(false);

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(LS_LIST_KEY, JSON.stringify({ key, rows, total }));
        } catch {}
      }
    })();
    return () => { on = false };
  }, [state.regional, state.unidade, state.q, state.page, state.pageSize]);

  function setFilter(patch: Partial<typeof state>) {
    setState({ ...state, ...patch, page: patch.page ? patch.page : 1 });
  }

  async function openDeliver(row: Row) {
    setModal({ open: true, row });
    setDeliverForm({ item: '', qtd: 1, data: new Date().toISOString().substring(0,10) });
    // kit
    const { json: kitJ } = await fetchJSON('/api/entregas/kit?funcao=' + encodeURIComponent(row.funcao), { cache: 'no-store' });
    const items: KitItem[] = (kitJ?.items || kitJ?.itens || []).map((r: any) => ({
      item: r.item ?? r.epi ?? r.epi_item ?? '',
      quantidade: Number(r.quantidade ?? 1) || 1,
      nome_site: r.nome_site ?? null,
    })).filter((x: any) => x.item);
    setKit(items);
    // deliveries
    const { json: dJ } = await fetchJSON('/api/entregas/deliver?cpf=' + encodeURIComponent(row.id), { cache: 'no-store' });
    setDeliv((dJ?.rows || []).map((r: any) => ({
      item: String(r.item || ''),
      qty_delivered: Number(r.qty_delivered || 0),
      qty_required: Number(r.qty_required || 0),
      deliveries: Array.isArray(r.deliveries) ? r.deliveries : [],
    })));
  }

  async function doDeliver() {
    if (!modal.row) return;
    const body = {
      cpf: modal.row.id,
      item: deliverForm.item,
      qty: deliverForm.qtd,
      date: deliverForm.data,
      required: kit.find(k => k.item === deliverForm.item)?.quantidade || 1,
    };
    const { json } = await fetchJSON('/api/entregas/deliver', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    if (json?.ok) {
      const { json: dJ } = await fetchJSON('/api/entregas/deliver?cpf=' + encodeURIComponent(modal.row.id), { cache: 'no-store' });
      setDeliv((dJ?.rows || []).map((r: any) => ({
        item: String(r.item || ''),
        qty_delivered: Number(r.qty_delivered || 0),
        qty_required: Number(r.qty_required || 0),
        deliveries: Array.isArray(r.deliveries) ? r.deliveries : [],
      })));
      setDeliverForm({ ...deliverForm, qtd: 1 });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        <div className="flex-1">
          <label className="text-xs block mb-1">Regional</label>
          <select
            value={state.regional}
            onChange={e => setFilter({ regional: e.target.value, unidade: '', page: 1 })}
            className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900"
          >
            <option value="">Selecione a Regional…</option>
            {regionais.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs block mb-1">Unidade</label>
          <select
            value={state.unidade}
            onChange={e => setFilter({ unidade: e.target.value, page: 1 })}
            className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900"
            disabled={!state.regional}
          >
            <option value="">(todas)</option>
            {unidades.map(u => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs block mb-1">Busca (nome/CPF)</label>
          <input
            value={state.q}
            onChange={e => setFilter({ q: e.target.value })}
            placeholder="Digite para filtrar…"
            className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900"
          />
        </div>
        <button onClick={openNewManual} className="px-3 py-2 rounded-xl bg-neutral-800 text-white dark:bg-emerald-600 self-end h-10 md:h-auto">Cadastrar colaborador</button>
        <div className="w-40">
          <label className="text-xs block mb-1">Itens por página</label>
          <select
            value={state.pageSize}
            onChange={e => setFilter({ pageSize: Number(e.target.value) || 25, page: 1 })}
            className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900"
          >
            {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {!state.regional && (
        <div className="p-4 rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          Selecione uma <strong>Regional</strong> para começar.
        </div>
      )}

      {state.regional && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50">
              <tr>
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">CPF</th>
                <th className="px-3 py-2 text-left">Função</th>
                <th className="px-3 py-2 text-left">Unidade</th>
                <th className="px-3 py-2 text-left">Regional</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-3 py-6 text-center opacity-70">Carregando…</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">{r.nome}</td>
                  <td className="px-3 py-2">{maskCPF(r.id)}</td>
                  <td className="px-3 py-2">{r.funcao}</td>
                  <td className="px-3 py-2">{r.unidade}</td>
                  <td className="px-3 py-2">{r.regional}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => openDeliver(r)} className="px-3 py-2 rounded-xl bg-neutral-800 text-white dark:bg-emerald-600">Entregar</button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center opacity-70">Sem resultados.</td></tr>
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-200 dark:border-neutral-800">
            <div className="text-xs opacity-70">Total: {total}</div>
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 rounded-lg border"
                disabled={state.page <= 1}
                onClick={() => setFilter({ page: Math.max(1, state.page - 1) })}
              >Anterior</button>
              <span className="text-xs opacity-70">Página {state.page} de {totalPages}</span>
              <button
                className="px-2 py-1 rounded-lg border"
                disabled={state.page >= totalPages}
                onClick={() => setFilter({ page: Math.min(totalPages, state.page + 1) })}
              >Próxima</button>
            </div>
          </div>
        </div>
      )}

            {modal.open && modal.row && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-50"
          onClick={() => setModal({ open: false })}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border flex flex-col gap-1">
              <div className="text-xs font-medium tracking-wide text-muted uppercase">
                Entregas de EPI
              </div>
              <div className="text-lg font-semibold">
                {modal.row.nome} <span className="text-xs text-muted">({maskCPF(modal.row.id)})</span>
              </div>
              <div className="text-xs text-muted">
                {modal.row.funcao} • {modal.row.unidade} • {modal.row.regional}
              </div>
            </div>

            <div className="px-5 py-4 grid md:grid-cols-2 gap-5">
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted uppercase mb-2">
                  Kit esperado — função
                </div>
                <div className="space-y-2">
                  {kit.map((k, i) => {
                    const delivered = deliv.find(d => d.item.toLowerCase() === (k.item || '').toLowerCase());
                    return (
                      <div key={i} className="border border-border rounded-xl px-3 py-2 bg-panel">
                        <div className="text-sm font-medium">{k.item}</div>
                        <div className="text-xs text-muted mt-0.5">
                          Requerido: {k.quantidade} • Entregue: {delivered?.qty_delivered || 0}
                        </div>
                      </div>
                    );
                  })}
                  {kit.length === 0 && (
                    <div className="text-sm text-muted">
                      Nenhum mapeamento de kit para esta função.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Registrar entrega
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    <select
                      value={deliverForm.item}
                      onChange={e => setDeliverForm({ ...deliverForm, item: e.target.value })}
                      className="select"
                    >
                      <option value="">Selecione o EPI…</option>
                      {kit.map((k, i) => (
                        <option key={i} value={k.item}>
                          {k.item}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={deliverForm.data}
                      onChange={e => setDeliverForm({ ...deliverForm, data: e.target.value })}
                      className="input"
                    />
                    <input
                      type="number"
                      min={1}
                      value={deliverForm.qtd}
                      onChange={e => setDeliverForm({ ...deliverForm, qtd: Math.max(1, Number(e.target.value) || 1) })}
                      className="input"
                    />
                    <button
                      onClick={doDeliver}
                      disabled={!deliverForm.item || !deliverForm.data || !deliverForm.qtd}
                      className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Dar baixa
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Entregas registradas
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {deliv.map((d, i) => (
                      <div key={i} className="border border-border rounded-xl px-3 py-2 bg-panel">
                        <div className="text-sm font-medium">
                          {d.item} — {d.qty_delivered} entregue(s)
                        </div>
                        <div className="text-xs text-muted">
                          {Array.isArray(d.deliveries)
                            ? d.deliveries.map((x: any) => `${x.qty} em ${x.date}`).join(', ')
                            : ''}
                        </div>
                      </div>
                    ))}
                    {deliv.length === 0 && (
                      <div className="text-sm text-muted">
                        Nenhuma entrega registrada ainda.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border flex justify-end">
              <button
                className="btn btn-ghost text-sm"
                onClick={() => setModal({ open: false })}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      

      {modalNew && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-50" onClick={()=>setModalNew(false)}>
          <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-2xl shadow-xl" onClick={e=>e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-lg font-semibold">Cadastrar colaborador</div>
              <div className="text-xs opacity-70">Use este cadastro quando o Alterdata ainda não refletiu a admissão.</div>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-3">
              <div><label className="text-xs block mb-1">CPF</label><input value={newColab.cpf} onChange={e=>setNewColab({...newColab, cpf: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" placeholder="000.000.000-00" /></div>
              <div><label className="text-xs block mb-1">Matrícula</label><input value={newColab.matricula||''} onChange={e=>setNewColab({...newColab, matricula: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" placeholder="(opcional)" /></div>
              <div className="md:col-span-2"><label className="text-xs block mb-1">Nome</label><input value={newColab.nome} onChange={e=>setNewColab({...newColab, nome: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" /></div>
              <div><label className="text-xs block mb-1">Função</label><input value={newColab.funcao} onChange={e=>setNewColab({...newColab, funcao: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" placeholder="Ex.: Enfermeiro UTI" /></div>
              <div><label className="text-xs block mb-1">Regional</label>
                <select value={newColab.regional} onChange={e=>setNewColab({...newColab, regional: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900">
                  <option value="">Selecione…</option>
                  {regionais.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="md:col-span-2"><label className="text-xs block mb-1">Unidade</label>
                <select value={newColab.unidade} onChange={e=>setNewColab({...newColab, unidade: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900">
                  <option value="">Selecione…</option>
                  {unidades.map(u => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
                </select>
              </div>
              <div><label className="text-xs block mb-1">Admissão</label><input type="date" value={newColab.admissao||''} onChange={e=>setNewColab({...newColab, admissao: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" /></div>
              <div><label className="text-xs block mb-1">Demissão</label><input type="date" value={newColab.demissao||''} onChange={e=>setNewColab({...newColab, demissao: e.target.value})} className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" /></div>
            </div>
            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-xl border" onClick={()=>setModalNew(false)}>Cancelar</button>
              <button className="px-3 py-2 rounded-xl bg-neutral-800 text-white dark:bg-emerald-600" onClick={saveNewManual}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}