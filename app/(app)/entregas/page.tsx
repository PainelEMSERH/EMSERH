'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string; nome_site?: string | null; };
type KitItem = { item: string; quantidade: number; nome_site?: string | null; };
type Deliver = { item: string; qty_delivered: number; qty_required: number; deliveries: Array<{date:string, qty:number}>; };

const LS_KEY = 'entregas:v2025-11-07';

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
      setLoading(true);
      const params = new URLSearchParams();
      params.set('regional', state.regional);
      if (state.unidade) params.set('unidade', state.unidade);
      if (state.q) params.set('q', state.q);
      params.set('page', String(state.page));
      params.set('pageSize', String(state.pageSize));
      const { json } = await fetchJSON('/api/entregas/list?' + params.toString(), { cache: 'no-store' });
      if (!on) return;
      setRows((json.rows || []) as Row[]);
      setTotal(Number(json.total || 0));
      setLoading(false);
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
      {/* Linha principal de filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs block mb-1 uppercase tracking-wide opacity-70">Regional</label>
            <select
              value={state.regional}
              onChange={e => setFilter({ regional: e.target.value, unidade: '', page: 1 })}
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
            >
              <option value="">Selecione a Regional…</option>
              {regionais.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-xs block mb-1 uppercase tracking-wide opacity-70">Unidade</label>
            <select
              value={state.unidade}
              onChange={e => setFilter({ unidade: e.target.value, page: 1 })}
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              disabled={!state.regional}
            >
              <option value="">(todas)</option>
              {unidades.map(u => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[220px]">
            <label className="text-xs block mb-1 uppercase tracking-wide opacity-70">Busca (nome / CPF)</label>
            <input
              value={state.q}
              onChange={e => setFilter({ q: e.target.value })}
              placeholder="Digite para filtrar…"
              className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
            />
          </div>

          <div className="flex items-end gap-3 justify-end">
            <div className="w-36">
              <label className="text-xs block mb-1 uppercase tracking-wide opacity-70">Itens por página</label>
              <select
                value={state.pageSize}
                onChange={e => setFilter({ pageSize: Number(e.target.value) || 25, page: 1 })}
                className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              >
                {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <button
              onClick={openNewManual}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-emerald-600 text-sm whitespace-nowrap"
            >
              Cadastrar colaborador
            </button>
          </div>
        </div>

        {/* Legenda de status e toggle fora da meta */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40 text-xs text-neutral-700 dark:text-neutral-300 gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="opacity-70">Legenda:</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Ativo</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span>Férias</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>INSS</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Licença maternidade</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Demitido 2025 sem EPI</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-neutral-400" />
              <span>Excluído da meta</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700">🅘</span>
              <span>observação rápida</span>
            </span>
          </div>

          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-neutral-400"
              checked={showExcluded}
              onChange={(e) => setShowExcluded(e.target.checked)}
            />
            <span>Mostrar colaboradores fora da meta</span>
          </label>
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
              {!loading && visibleRows.map((r) => {
                const st = statusMap[r.id];
                const code: StatusCode = (st?.code || 'ATIVO');
                const label = st?.label || STATUS_LABELS[code];
                const obs = st?.obs || '';
                const isForaMeta = EXCLUDED_STATUS.includes(code);
                return (
                  <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${statusDotClass(code)}`} />
                        <span className="truncate">{r.nome}</span>
                        {(obs || code !== 'ATIVO') && (
                          <span
                            className="text-[11px] px-1.5 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 cursor-default"
                            title={obs || label}
                          >
                            🅘
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{maskCPF(r.id)}</td>
                    <td className="px-3 py-2">{r.funcao}</td>
                    <td className="px-3 py-2">{r.unidade}</td>
                    <td className="px-3 py-2">{r.regional}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openStatusModal(r, st)}
                          className="px-2 py-1 rounded-lg border text-xs"
                        >
                          Situação
                        </button>
                        <button
                          onClick={() => openDeliver(r)}
                          disabled={isForaMeta}
                          className={\`px-3 py-2 rounded-xl text-sm \${isForaMeta
                            ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-500'
                            : 'bg-neutral-800 text-white dark:bg-emerald-600'}\`}
                        >
                          Entregar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && visibleRows.length === 0 && (
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


      {statusModal.open && statusModal.row && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-50"
          onClick={() => setStatusModal({ open: false })}
        >
          <div
            className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide opacity-70">Situação do colaborador</div>
                <div className="font-semibold text-sm truncate">
                  {statusModal.row?.nome} <span className="opacity-60 text-xs ml-1">({maskCPF(statusModal.row?.id)})</span>
                </div>
              </div>
              <button
                onClick={() => setStatusModal({ open: false })}
                className="text-xs px-2 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700"
              >
                Fechar
              </button>
            </div>
            <div className="px-4 py-4 space-y-3 text-sm">
              <div>
                <label className="text-xs block mb-1">Status</label>
                <select
                  value={statusModal.code || 'ATIVO'}
                  onChange={(e) =>
                    setStatusModal((prev) => ({
                      ...prev,
                      code: e.target.value as StatusCode,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                >
                  <option value="ATIVO">Ativo (entra na meta)</option>
                  <option value="FERIAS">Férias</option>
                  <option value="INSS">INSS</option>
                  <option value="LICENCA_MATERNIDADE">Licença maternidade</option>
                  <option value="DEMITIDO_2025_SEM_EPI">Demitido 2025 sem EPI (fora da meta, justificado)</option>
                  <option value="EXCLUIDO_META">Excluído da meta (outros motivos)</option>
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1">Observação rápida (aparece no 🅘)</label>
                <input
                  type="text"
                  maxLength={100}
                  value={statusModal.obs || ''}
                  onChange={(e) =>
                    setStatusModal((prev) => ({
                      ...prev,
                      obs: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                  placeholder="Ex.: Férias jan/2025; Gestante; INSS desde 02/2025..."
                />
              </div>
              <p className="text-[11px] opacity-70">
                Colaboradores marcados como <strong>Demitido 2025 sem EPI</strong> ou <strong>Excluído da meta</strong> ficam com o botão de entrega desativado
                e são sinalizados como <em>fora da meta</em> nesta tela e nos futuros dashboards.
              </p>
            </div>
            <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                onClick={() => setStatusModal({ open: false })}
                className="px-3 py-2 rounded-xl text-sm border border-neutral-300 dark:border-neutral-700"
              >
                Cancelar
              </button>
              <button
                onClick={saveStatusModal}
                className="px-4 py-2 rounded-xl text-sm bg-neutral-800 text-white dark:bg-emerald-600"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.open && modal.row && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-50" onClick={() => setModal({ open: false })}>
          <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-3xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-lg font-semibold">Entregas de EPI — {modal.row.nome} ({maskCPF(modal.row.id)})</div>
              <div className="text-xs opacity-70">{modal.row.funcao} • {modal.row.unidade} • {modal.row.regional}</div>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-4">
              <div>
                <div className="font-medium text-sm">Kit esperado</div>
                <div className="space-y-2 mt-2">
                  {kit.map((k, i) => {
                    const delivered = deliv.find(d => d.item.toLowerCase() === (k.item||'').toLowerCase());
                    return (
                      <div key={i} className="border rounded-xl p-2">
                        <div className="text-sm">{k.item}</div>
                        <div className="text-xs opacity-70">
                          Requerido: {k.quantidade} • Entregue: {delivered?.qty_delivered || 0}
                        </div>
                      </div>
                    );
                  })}
                  {kit.length === 0 && <div className="text-sm opacity-70">Nenhum mapeamento de kit para esta função.</div>}
                </div>
              </div>

              <div>
                <div className="font-medium text-sm">Registrar entrega</div>
                <div className="flex flex-col gap-2 mt-2">
                  <select value={deliverForm.item} onChange={e => setDeliverForm({ ...deliverForm, item: e.target.value })} className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900">
                    <option value="">Selecione o EPI…</option>
                    {kit.map((k, i) => <option key={i} value={k.item}>{k.item}</option>)}
                  </select>
                  <input type="date" value={deliverForm.data} onChange={e => setDeliverForm({ ...deliverForm, data: e.target.value })} className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" />
                  <input type="number" min={1} value={deliverForm.qtd} onChange={e => setDeliverForm({ ...deliverForm, qtd: Math.max(1, Number(e.target.value)||1) })} className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-900" />
                  <button onClick={doDeliver} disabled={!deliverForm.item || deliverForm.qtd <= 0} className="px-3 py-2 rounded-xl bg-neutral-800 text-white dark:bg-emerald-600">Dar baixa</button>
                </div>

                <div className="mt-4">
                  <div className="font-medium text-sm">Entregas registradas</div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {deliv.map((d, i) => (
                      <div key={i} className="border rounded-xl p-2">
                        <div className="text-sm">{d.item} — {d.qty_delivered} entregue(s)</div>
                        <div className="text-xs opacity-70">Lançamentos: {Array.isArray(d.deliveries) ? d.deliveries.map((x: any) => `${x.qty} em ${x.date}`).join(', ') : ''}</div>
                      </div>
                    ))}
                    {deliv.length === 0 && <div className="text-sm opacity-70">Nenhuma entrega registrada ainda.</div>}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
              <button className="px-3 py-2 rounded-xl border" onClick={() => setModal({ open: false })}>Fechar</button>
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