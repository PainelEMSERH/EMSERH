// file: app/(app)/estoque/page.tsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';

type Row = { id:string; regionalId:string; regional:string; unidadeId:string; unidade:string; itemId:string; item:string; categoria?:string | null; quantidade:number; minimo:number; maximo:number };
type Mov = { id:string; tipo:'entrada'|'saida'; quantidade:number; destino?:string; observacao?:string; data:string; unidadeId:string; unidade:string; regionalId:string; regional:string; itemId:string; item:string };
type Pedido = { id:string; status:'pendente'|'recebido'|'cancelado'; criadoEm:string; previstoEm?:string; recebidoEm?:string; observacao?:string; regionalId?:string; regional?:string; unidadeId?:string; unidade?:string; qtd_solicitada:number; qtd_recebida:number };
type Opts = { regionais:string[]; unidades:{unidade:string, regional:string}[] };
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

async function fetchJSON<T>(u:string, init?:RequestInit){ const r = await fetch(u, { cache:'no-store', ...init }); if(!r.ok) throw new Error(await r.text()); return r.json() as Promise<T>; }

export default function Page(){
  const [tab, setTab] = useState<'visao'|'mov'|'ped'>('visao');

  const [regional,setRegional] = useState('');
  const [unidade,setUnidade] = useState('');
  const [q,setQ] = useState('');

  const [rows,setRows] = useState<Row[]>([]); const [total,setTotal] = useState(0);
  const [page,setPage] = useState(1); const [size,setSize] = useState(25);
  const [opts,setOpts] = useState<Opts>({ regionais:[], unidades:[] });

  const [movs,setMovs] = useState<Mov[]>([]); const [movTotal,setMovTotal] = useState(0); const [movPage,setMovPage] = useState(1);

  const [novoTipo,setNovoTipo] = useState<'entrada'|'saida'>('entrada');
  const [novoItemId,setNovoItemId] = useState('');
  const [novoUnidadeId,setNovoUnidadeId] = useState('');
  const [novoQtd,setNovoQtd] = useState<number>(0);
  const [novoDestino,setNovoDestino] = useState('');
  const [novoObs,setNovoObs] = useState('');
  const [novoData,setNovoData] = useState('');

  const [peds,setPeds] = useState<Pedido[]>([]); const [pedTotal,setPedTotal] = useState(0); const [pedPage,setPedPage] = useState(1);
  const [pedPrevisto,setPedPrevisto] = useState('');
  const [pedObs,setPedObs] = useState('');
const [pedItens,setPedItens] = useState<Array<{itemId:string, quantidade:number}>>([]);

  const [pedTipo, setPedTipo] = useState<'entrada' | 'saida'>('entrada');
  const [pedDestinoUnidade, setPedDestinoUnidade] = useState('');
  const [pedOrigem, setPedOrigem] = useState('');

// Configuração de mínimo/máximo por item/unidade
const [editRow, setEditRow] = useState<Row | null>(null);
const [editMin, setEditMin] = useState<string>('');
const [editMax, setEditMax] = useState<string>('');
const [savingConfig, setSavingConfig] = useState(false);

// Cadastro rápido de novo item de estoque
const [newItemNome, setNewItemNome] = useState('');
const [newItemCategoria, setNewItemCategoria] = useState('EPI');
const [newItemUnidadeMedida, setNewItemUnidadeMedida] = useState('UN');
const [newItemUnidade, setNewItemUnidade] = useState('');
const [newItemQtdInicial, setNewItemQtdInicial] = useState<number>(0);
const [newItemSaving, setNewItemSaving] = useState(false);

// Busca no catálogo SESMT (planilha)
const [catQuery, setCatQuery] = useState('');
const [catOptions, setCatOptions] = useState<CatalogItem[]>([]);
const [catLoading, setCatLoading] = useState(false);
const [itemOptions, setItemOptions] = useState<Array<{id:string, nome:string}>>([]);

  useEffect(()=>{ fetchJSON<Opts>('/api/estoque/options').then(setOpts).catch(()=>{}); },[]);
useEffect(() => {
  let mounted = true;
  fetchJSON<{ items: { id: string; nome: string }[] }>('/api/estoque/items')
    .then((d) => {
      if (!mounted) return;
      setItemOptions(d.items || []);
    })
    .catch(() => {
      if (!mounted) return;
      setItemOptions([]);
    });
  return () => {
    mounted = false;
  };
}, []);


  useEffect(()=>{
    let mounted = true;
    const url = `/api/estoque/list?regionalId=${encodeURIComponent(regional)}&unidadeId=${encodeURIComponent(unidade)}&q=${encodeURIComponent(q)}&page=${page}&size=${size}`;
    fetchJSON<{ rows:Row[], total:number }>(url).then(d => { if(mounted){ setRows(d.rows||[]); setTotal(d.total||0); } }).catch(()=>{});
    return () => { mounted = false };
  }, [regional, unidade, q, page, size]);

  useEffect(()=>{
    if (tab !== 'mov') return;
    let mounted = true;
    const url = `/api/estoque/mov?regionalId=${encodeURIComponent(regional)}&unidadeId=${encodeURIComponent(unidade)}&page=${movPage}&size=25`;
    fetchJSON<{ rows:Mov[], total:number }>(url).then(d => { if(mounted){ setMovs(d.rows||[]); setMovTotal(d.total||0); } }).catch(()=>{});
    return () => { mounted = false };
  }, [tab, regional, unidade, movPage]);

  useEffect(()=>{
    if (tab !== 'ped') return;
    let mounted = true;
    const url = `/api/estoque/pedidos?regionalId=${encodeURIComponent(regional)}&unidadeId=${encodeURIComponent(unidade)}&page=${pedPage}&size=25`;
    fetchJSON<{ rows:Pedido[], total:number }>(url).then(d => { if(mounted){ setPeds(d.rows||[]); setPedTotal(d.total||0); } }).catch(()=>{});
    return () => { mounted = false };
  }, [tab, regional, unidade, pedPage]);

  const unidadesFiltradas = useMemo(()=> opts.unidades.filter(u => !regional || u.regional===regional), [opts, regional]);

  const sesmtUnidadeNome = React.useMemo(() => {
    if (!regional) return '';
    const reg = regional.toUpperCase();
    return `ESTOQUE SESMT - ${reg}`;
  }, [regional]);


  const itensCat = useMemo(()=> itemOptions, [itemOptions]);

  const resumo = useMemo(() => {
    let totalItens = rows.length;
    let baixo = 0;
    let zerado = 0;
    let semMinimo = 0;
    const porCategoria: Record<string, { itens:number; quantidade:number }> = {};
    for (const r of rows) {
      if (r.quantidade <= 0) zerado++;
      if (r.minimo > 0 && r.quantidade > 0 && r.quantidade <= r.minimo) baixo++;
      if (r.minimo === 0) semMinimo++;
      const cat = (r.categoria || 'Sem categoria').toString();
      if (!porCategoria[cat]) porCategoria[cat] = { itens: 0, quantidade: 0 };
      porCategoria[cat].itens += 1;
      porCategoria[cat].quantidade += r.quantidade ?? 0;
    }
    return { totalItens, baixo, zerado, semMinimo, porCategoria };
  }, [rows]);;
    fetchJSON<{ items: CatalogItem[] }>(url)
      .then(d => {
        if (!active) return;
        setCatOptions(d.items || []);
      })
      .catch(() => {
        if (!active) return;
        setCatOptions([]);
      })
      .finally(() => {
        if (!active) return;
        setCatLoading(false);
      });
    return () => {
      active = false;
    };
  }, [catQuery]);


  async function criarMov(){
    const body = { unidadeId: sesmtUnidadeNome, itemId: novoItemId, tipo: novoTipo, quantidade: novoQtd, destino: novoDestino||null, observacao: novoObs||null, data: novoData||null };
    await fetchJSON('/api/estoque/mov', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    setNovoQtd(0); setNovoDestino(''); setNovoObs(''); setNovoData('');
    const url = `/api/estoque/mov?regionalId=${encodeURIComponent(regional)}&unidadeId=${encodeURIComponent(unidade)}&page=${movPage}&size=25`;
    fetchJSON<{ rows:Mov[], total:number }>(url).then(d => { setMovs(d.rows||[]); setMovTotal(d.total||0); });
    const urlSaldo = `/api/estoque/list?regionalId=${encodeURIComponent(regional)}&unidadeId=${encodeURIComponent(unidade)}&q=${encodeURIComponent(q)}&page=${page}&size=${size}`;
    fetchJSON<{ rows:Row[], total:number }>(urlSaldo).then(d => { setRows(d.rows||[]); setTotal(d.total||0); });
  }

  async function criarPedido(){
    const body:any = { regionalId: regional || null, unidadeId: unidade || null, previstoEm: pedPrevisto || null, observacao: pedObs || null, itens: pedItens };
    await fetchJSON('/api/estoque/pedidos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });

    // Também gera movimentações no estoque SESMT com base nos itens do pedido
    const unidadeEstoque = sesmtUnidadeNome;
    if (unidadeEstoque && pedItens.length > 0) {
      for (const it of pedItens) {
        if (!it.itemId || !it.quantidade) continue;
        const movBody = {
          unidadeId: unidadeEstoque,
          itemId: it.itemId,
          tipo: pedTipo,
          quantidade: it.quantidade,
          destino: pedTipo === 'saida' ? (pedDestinoUnidade || null) : (pedOrigem || null),
          observacao: pedObs || null,
          data: pedPrevisto || null,
        };
        await fetchJSON('/api/estoque/mov', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(movBody),
        });
      }
    }

    setPedItens([]); setPedObs(''); setPedPrevisto('');
    const url = `/api/estoque/pedidos?regionalId=${encodeURIComponent(regional)}&unidadeId=${encodeURIComponent(unidade)}&page=${pedPage}&size=25`;
    fetchJSON<{ rows:Pedido[], total:number }>(url).then(d => { setPeds(d.rows||[]); setPedTotal(d.total||0); });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-xl border border-border bg-panel p-4">
        <h1 className="text-xl font-semibold mb-1">Estoque</h1>
        <p className="text-sm text-muted mb-3">Controle completo por Regional/Unidade: saldo, movimentações e pedidos de reposição.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="px-3 py-2 rounded bg-card border border-border" placeholder="Buscar item/unidade" value={q} onChange={e=>{setQ(e.target.value); setPage(1)}}/>
          <select className="px-3 py-2 rounded bg-card border border-border" value={regional} onChange={e=>{setRegional(e.target.value); setPage(1)}}>
            <option value="">Todas as Regionais</option>
            {opts.regionais.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="px-3 py-2 rounded bg-card border border-border" value={unidade} onChange={e=>{setUnidade(e.target.value); setPage(1)}}>
            <option value="">Todas as Unidades</option>
            {unidadesFiltradas.map(u => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
          </select>
        </div>
        <div className="mt-4 flex gap-2 text-xs">
          <button onClick={()=>setTab('visao')} className={`px-3 py-1 rounded border ${tab==='visao'?'bg-white/10':''}`}>Visão Geral</button>
          <button onClick={()=>setTab('mov')} className={`px-3 py-1 rounded border ${tab==='mov'?'bg-white/10':''}`}>Movimentações</button>
          <button onClick={()=>setTab('ped')} className={`px-3 py-1 rounded border ${tab==='ped'?'bg-white/10':''}`}>Pedidos de Reposição</button>
        </div>
      </div>

      {tab==='visao' && (
  <div className="rounded-xl border border-border bg-panel">
    {/* Cards de resumo do estoque */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border-b border-border text-xs">
      <div className="rounded-lg bg-card px-3 py-2 flex flex-col gap-1">
        <div className="text-muted">Itens em estoque</div>
        <div className="text-lg font-semibold">{resumo.totalItens}</div>
      </div>
      <div className="rounded-lg bg-card px-3 py-2 flex flex-col gap-1">
        <div className="text-muted">Abaixo do mínimo</div>
        <div className="text-lg font-semibold">{resumo.baixo}</div>
      </div>
      <div className="rounded-lg bg-card px-3 py-2 flex flex-col gap-1">
        <div className="text-muted">Zerados</div>
        <div className="text-lg font-semibold">{resumo.zerado}</div>
      </div>
      <div className="rounded-lg bg-card px-3 py-2 flex flex-col gap-1">
        <div className="text-muted">Sem mínimo configurado</div>
        <div className="text-lg font-semibold">{resumo.semMinimo}</div>
      </div>
    </div>

    {/* Tabela de saldo por item */}
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-white/10">
          <tr>
            <th className="px-3 py-2 text-left">Regional</th>
            <th className="px-3 py-2 text-left">Unidade</th>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-right">Qtd</th>
            <th className="px-3 py-2 text-right">Mín</th>
            <th className="px-3 py-2 text-right">Máx</th>
            <th className="px-3 py-2 text-left">Situação</th>
            <th className="px-3 py-2 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const zero = r.quantidade <= 0;
            const baixo = r.minimo > 0 && r.quantidade > 0 && r.quantidade <= r.minimo;
            const semMinimo = r.minimo === 0;
            let badge = 'OK';
            let badgeClass = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-emerald-500/10 text-emerald-300';
            if (zero) {
              badge = 'Zerado';
              badgeClass = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-red-500/10 text-red-300';
            } else if (baixo) {
              badge = 'Abaixo do mínimo';
              badgeClass = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-amber-500/10 text-amber-300';
            } else if (semMinimo) {
              badge = 'Sem mínimo';
              badgeClass = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] bg-slate-500/10 text-slate-200';
            }
            return (
              <tr
                key={r.id}
                className={
                  'border-t border-border hover:bg-white/5 ' +
                  (zero ? 'bg-red-500/5' : baixo ? 'bg-amber-500/5' : '')
                }
              >
                <td className="px-3 py-2">{r.regional}</td>
                <td className="px-3 py-2">{r.unidade}</td>
                <td className="px-3 py-2">{r.item}</td>
                <td className="px-3 py-2 text-right">{r.quantidade}</td>
                <td className="px-3 py-2 text-right">{r.minimo}</td>
                <td className="px-3 py-2 text-right">{r.maximo}</td>
                <td className="px-3 py-2">
                  <span className={badgeClass}>{badge}</span>
                </td>
                <td className="px-3 py-2">
                  <button
                    className="px-2 py-1 text-[11px] rounded border border-border hover:bg-white/10"
                    onClick={() => {
                      setEditRow(r);
                      setEditMin(String(r.minimo ?? 0));
                      setEditMax(String(r.maximo ?? 0));
                    }}
                  >
                    Configurar
                  </button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-muted">
                Nenhum registro
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

    {/* Edição rápida de mínimo/máximo */}
    {editRow && (
      <div className="border-t border-border px-4 py-3 text-xs bg-card/40 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <div className="text-muted mb-1">
            Configurar mínimo/máximo para <strong>{editRow.item}</strong> ({editRow.unidade})
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted">Mínimo</label>
          <input
            className="px-2 py-1 rounded bg-card border border-border text-xs w-24"
            value={editMin}
            onChange={e => setEditMin(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted">Máximo (opcional)</label>
          <input
            className="px-2 py-1 rounded bg-card border border-border text-xs w-24"
            value={editMax}
            onChange={e => setEditMax(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
          />
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded border border-border text-[11px] disabled:opacity-50"
            disabled={savingConfig}
            onClick={async () => {
              if (!editRow) return;
              const minimo = Number(editMin || '0');
              const maximo = editMax ? Number(editMax) : null;
              try {
                setSavingConfig(true);
                await fetchJSON('/api/estoque/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    unidadeId: editRow.unidadeId,
                    itemId: editRow.itemId,
                    minimo,
                    maximo,
                  }),
                });
                const urlSaldo = `/api/estoque/list?regionalId=${encodeURIComponent(
                  regional
                )}&unidadeId=${encodeURIComponent(unidade)}&q=${encodeURIComponent(q)}&page=${page}&size=${size}`;
                const d = await fetchJSON<{ rows: Row[]; total: number }>(urlSaldo);
                setRows(d.rows || []);
                setTotal(d.total || 0);
                setEditRow(null);
              } catch (e) {
                console.error(e);
              } finally {
                setSavingConfig(false);
              }
            }}
          >
            Salvar
          </button>
          <button
            className="px-3 py-2 rounded border border-border text-[11px]"
            onClick={() => setEditRow(null)}
          >
            Cancelar
          </button>
        </div>
      </div>
    )}

    {/* Cadastro rápido de novo item vinculado à Unidade */}
    <div className="border-t border-border px-4 py-4 text-xs bg-card/20 flex flex-col gap-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">Cadastrar novo item</div>
          <div className="text-muted">
            Use o catálogo SESMT para buscar o item ou preencha manualmente. O estoque inicial será lançado para a unidade selecionada.
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 items-center">
          <input
            className="px-3 py-2 rounded bg-card border border-border text-xs"
            placeholder="Buscar no catálogo SESMT (código ou descrição)"
            value={catQuery}
            onChange={e => setCatQuery(e.target.value)}
          />
          {catLoading && <span className="text-[11px] text-muted">Buscando...</span>}
        </div>
      </div>

      {catOptions.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded border border-border bg-card text-[11px] mt-2">
          {catOptions.map((c, idx) => (
            <button
              key={idx}
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-white/10 border-b border-border last:border-b-0"
              onClick={() => {
                setNewItemNome(c.descricao_site || c.descricao_cahosp || '');
                setNewItemCategoria(c.categoria_site || 'EPI');
                setNewItemUnidadeMedida(c.unidade_site || 'UN');
              }}
            >
              <div className="font-medium">
                {c.descricao_site || c.descricao_cahosp || 'Sem descrição'}
              </div>
              <div className="text-muted">
                {c.codigo_pa ? `Código: ${c.codigo_pa}` : ''}
                {c.grupo_cahosp ? ` · Grupo: ${c.grupo_cahosp}` : ''}
                {c.tamanho_site ? ` · Tam.: ${c.tamanho_site}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-3">
        <input
          className="px-3 py-2 rounded bg-card border border-border text-xs md:col-span-2"
          placeholder="Nome do item"
          value={newItemNome}
          onChange={e => setNewItemNome(e.target.value)}
        />
        <input
          className="px-3 py-2 rounded bg-card border border-border text-xs"
          placeholder="Categoria"
          value={newItemCategoria}
          onChange={e => setNewItemCategoria(e.target.value)}
        />
        <input
          className="px-3 py-2 rounded bg-card border border-border text-xs"
          placeholder="Unidade de medida (ex.: UN, PAR)"
          value={newItemUnidadeMedida}
          onChange={e => setNewItemUnidadeMedida(e.target.value)}
        />
        <input
          className="px-3 py-2 rounded bg-card border border-border text-xs"
          value={sesmtUnidadeNome || (regional ? 'Defina o estoque do SESMT' : 'Selecione uma Regional')}
          readOnly
        />
        <input
          className="px-3 py-2 rounded bg-card border border-border text-xs w-full"
          placeholder="Qtd inicial"
          value={newItemQtdInicial ? String(newItemQtdInicial) : ''}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, '');
            setNewItemQtdInicial(v ? Number(v) : 0);
          }}
          inputMode="numeric"
        />
      </div>
      <div className="flex justify-end mt-2">
        <button
          className="px-3 py-2 rounded border border-border text-[11px] disabled:opacity-50"
          disabled={
            newItemSaving ||
            !newItemNome ||
            !sesmtUnidadeNome
          }
          onClick={async () => {
            try {
              setNewItemSaving(true);
              const unidadeKey = sesmtUnidadeNome;
              await fetchJSON('/api/estoque/item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nome: newItemNome,
                  categoria: newItemCategoria || 'EPI',
                  unidadeMedida: newItemUnidadeMedida || 'UN',
                  unidadeId: unidadeKey,
                  regional: regional || null,
                  quantidadeInicial: newItemQtdInicial || 0,
                }),
              });
                    const itemsResp = await fetchJSON<{ items: { id: string; nome: string }[] }>('/api/estoque/items');
                    setItemOptions(itemsResp.items || []);

              setNewItemNome('');
              setNewItemCategoria('EPI');
              setNewItemUnidadeMedida('UN');
              setNewItemUnidade('');
              setNewItemQtdInicial(0);
              setCatQuery('');
              setCatOptions([]);
              const urlSaldo = `/api/estoque/list?regionalId=${encodeURIComponent(
                regional
              )}&unidadeId=${encodeURIComponent(unidade)}&q=${encodeURIComponent(q)}&page=${page}&size=${size}`;
              const d = await fetchJSON<{ rows: Row[]; total: number }>(urlSaldo);
              setRows(d.rows || []);
              setTotal(d.total || 0);
            } catch (e) {
              console.error(e);
            } finally {
              setNewItemSaving(false);
            }
          }}
        >
          Salvar novo item
        </button>
      </div>
    </div>

    <div className="flex items-center justify-between p-3 text-xs text-muted">
      <div>Total: {total}</div>
      <div className="flex items-center gap-2">
        <button
          className="px-2 py-1 border border-border rounded disabled:opacity-40"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Anterior
        </button>
        <div>Página {page}</div>
        <button
          className="px-2 py-1 border border-border rounded disabled:opacity-40"
          onClick={() => setPage(p => p + 1)}
          disabled={rows.length < size}
        >
          Próxima
        </button>
      </div>
    </div>
  </div>
)}
      {tab==='mov' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-panel p-4">
            <h2 className="font-semibold mb-2">Nova movimentação</h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <select className="px-3 py-2 rounded bg-card border border-border" value={novoTipo} onChange={e=>setNovoTipo(e.target.value as any)}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
              <input
                className="px-3 py-2 rounded bg-card border border-border text-xs"
                value={sesmtUnidadeNome || (regional ? 'Estoque do SESMT da Regional selecionada' : 'Selecione uma Regional')}
                readOnly
              />
              <select className="px-3 py-2 rounded bg-card border border-border" value={novoItemId} onChange={e=>setNovoItemId(e.target.value)}>
                <option value="">Item</option>
                {itensCat.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
              <input type="number" className="px-3 py-2 rounded bg-card border border-border" placeholder="Quantidade" value={novoQtd} onChange={e=>setNovoQtd(parseInt(e.target.value||'0',10))}/>
              <input className="px-3 py-2 rounded bg-card border border-border" placeholder="Destino/Justificativa" value={novoDestino} onChange={e=>setNovoDestino(e.target.value)}/>
              <input type="date" className="px-3 py-2 rounded bg-card border border-border" value={novoData} onChange={e=>setNovoData(e.target.value)}/>
            </div>
            <div className="mt-2">
              <input className="w-full px-3 py-2 rounded bg-card border border-border" placeholder="Observação" value={novoObs} onChange={e=>setNovoObs(e.target.value)}/>
            </div>
            <div className="mt-3 flex justify-end">
              <button className="px-3 py-2 border rounded" onClick={criarMov} disabled={!sesmtUnidadeNome || !novoItemId || !novoQtd || (novoTipo==='saida' && !novoUnidadeId)}>Salvar movimentação</button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/10"><tr>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Unidade</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2 text-left">Destino</th>
                  <th className="px-3 py-2 text-left">Obs</th>
                </tr></thead>
                <tbody>
                  {movs.map(m => (
                    <tr key={m.id} className="border-t border-border hover:bg-white/10">
                      <td className="px-3 py-2">{new Date(m.data).toLocaleString()}</td>
                      <td className="px-3 py-2 capitalize">{m.tipo}</td>
                      <td className="px-3 py-2">{m.unidade}</td>
                      <td className="px-3 py-2">{m.item}</td>
                      <td className="px-3 py-2 text-right">{m.quantidade}</td>
                      <td className="px-3 py-2">{m.destino || '-'}</td>
                      <td className="px-3 py-2">{m.observacao || '-'}</td>
                    </tr>
                  ))}
                  {movs.length===0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">Sem movimentações</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between p-3 text-xs text-muted">
              <div>Total: {movTotal}</div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 border border-border rounded disabled:opacity-40" onClick={()=>setMovPage(p=>Math.max(1,p-1))} disabled={movPage===1}>Anterior</button>
                <div>Página {movPage}</div>
                <button className="px-2 py-1 border border-border rounded disabled:opacity-40" onClick={()=>setMovPage(p=>p+1)} disabled={movs.length<25}>Próxima</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab==='ped' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-panel p-4">
            <h2 className="font-semibold mb-2">Novo pedido de reposição</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <select
                className="px-3 py-2 rounded bg-card border border-border text-xs"
                value={pedTipo}
                onChange={e => setPedTipo(e.target.value as 'entrada' | 'saida')}
              >
                <option value="entrada">Entrada (chegada no SESMT)</option>
                <option value="saida">Saída (para unidade)</option>
              </select>
              <input
                className="px-3 py-2 rounded bg-card border border-border text-xs"
                value={sesmtUnidadeNome || (regional ? 'Estoque do SESMT da Regional selecionada' : 'Selecione uma Regional')}
                readOnly
              />
              {pedTipo==='saida' ? (
                <select
                  className="px-3 py-2 rounded bg-card border border-border text-xs"
                  value={pedDestinoUnidade}
                  onChange={e => setPedDestinoUnidade(e.target.value)}
                >
                  <option value="">Unidade hospitalar destino</option>
                  {unidadesFiltradas.map(u => (
                    <option key={u.unidade} value={u.unidade}>{u.unidade}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="px-3 py-2 rounded bg-card border border-border text-xs"
                  placeholder="Origem (ex.: CAHOSP)"
                  value={pedOrigem}
                  onChange={e => setPedOrigem(e.target.value)}
                />
              )}
              <input
                type="date"
                className="px-3 py-2 rounded bg-card border border-border text-xs"
                value={pedPrevisto}
                onChange={e => setPedPrevisto(e.target.value)}
              />
              <input
                className="px-3 py-2 rounded bg-card border border-border text-xs"
                placeholder="Observação"
                value={pedObs}
                onChange={e => setPedObs(e.target.value)}
              />
            </div>
            <div className="mt-3">
              <div className="text-xs text-text mb-1">Itens do pedido</div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                <select className="px-3 py-2 rounded bg-card border border-border" onChange={e=>setPedItens(p=>[...p,{itemId:e.target.value, quantidade:1}])}>
                  <option value="">Adicionar item...</option>
                  {itensCat.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
                <div className="col-span-5 text-xs text-muted">
                  {pedItens.map((it,idx)=> (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 border border-border rounded mr-2 mb-2">
                      <input type="number" className="w-16 bg-transparent text-right" value={it.quantidade} onChange={e=>{
                        const v = parseInt(e.target.value||'0',10);
                        setPedItens(arr => arr.map((x,i)=> i===idx ? {...x, quantidade: v}: x));
                      }} />
                      <button onClick={()=> setPedItens(arr => arr.filter((_,i)=>i!==idx))}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button className="px-3 py-2 border rounded" onClick={criarPedido} disabled={!sesmtUnidadeNome || pedItens.length===0 || (pedTipo==='saida' && !pedDestinoUnidade)}>Criar pedido</button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-panel">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/10"><tr>
                  <th className="px-3 py-2 text-left">Criado em</th>
                  <th className="px-3 py-2 text-left">Unidade</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Qtd Solicitada</th>
                  <th className="px-3 py-2 text-right">Qtd Recebida</th>
                  <th className="px-3 py-2 text-left">Previsto</th>
                  <th className="px-3 py-2 text-left">Recebido</th>
                </tr></thead>
                <tbody>
                  {peds.map(p => (
                    <tr key={p.id} className="border-t border-border hover:bg-white/10">
                      <td className="px-3 py-2">{new Date(p.criadoEm).toLocaleString()}</td>
                      <td className="px-3 py-2">{p.unidade || p.regional || '-'}</td>
                      <td className="px-3 py-2 capitalize">{p.status}</td>
                      <td className="px-3 py-2 text-right">{p.qtd_solicitada}</td>
                      <td className="px-3 py-2 text-right">{p.qtd_recebida}</td>
                      <td className="px-3 py-2">{p.previstoEm ? new Date(p.previstoEm).toLocaleDateString() : '-'}</td>
                      <td className="px-3 py-2">{p.recebidoEm ? new Date(p.recebidoEm).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                  {peds.length===0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">Nenhum pedido</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between p-3 text-xs text-muted">
              <div>Total: {pedTotal}</div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 border border-border rounded disabled:opacity-40" onClick={()=>setPedPage(p=>Math.max(1,p-1))} disabled={pedPage===1}>Anterior</button>
                <div>Página {pedPage}</div>
                <button className="px-2 py-1 border border-border rounded disabled:opacity-40" onClick={()=>setPedPage(p=>p+1)} disabled={peds.length<25}>Próxima</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
