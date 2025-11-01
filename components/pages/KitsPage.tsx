'use client';
import React from 'react';

type KitItem = { itemId: string; itemNome?: string; quantidade: number };
type Kit = { id?: string; nome: string; descricao?: string | null; itens: KitItem[]; updatedAt?: string };

type ItemOption = { id: string; nome: string };

const fetchJSON = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'Erro');
  return j;
};

export default function KitsPage() {
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [rows, setRows] = React.useState<Kit[]>([]);

  const [options, setOptions] = React.useState<ItemOption[]>([]);

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Kit | null>(null);
  const emptyKit: Kit = { nome: '', descricao: '', itens: [] };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetchJSON(`/api/kits/list?q=${encodeURIComponent(q)}&page=${page}&size=${size}`);
      setRows(j.data);
      setTotal(j.total);
    } catch (e:any) {
      console.error(e);
      alert('Falha ao carregar kits');
    } finally { setLoading(false); }
  }, [q, page, size]);

  const loadOptions = React.useCallback(async () => {
    try {
      const j = await fetchJSON('/api/items/options');
      setOptions(j.data);
    } catch (e) { console.error(e); }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { loadOptions(); }, [loadOptions]);

  const onNew = () => { setEditing({ ...emptyKit }); setOpen(true); };
  const onEdit = (k: Kit) => { setEditing(JSON.parse(JSON.stringify(k))); setOpen(true); };
  const onClose = () => { setOpen(false); setEditing(null); };

  const onSave = async () => {
    if (!editing) return;
    if (!editing.nome || editing.nome.trim()==='') { alert('Informe o nome do kit'); return; }
    try {
      const j = await fetchJSON('/api/kits/upsert', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(editing),
      });
      onClose();
      await load();
    } catch(e:any) {
      console.error(e);
      alert('Falha ao salvar');
    }
  };

  const onDelete = async (id?: string) => {
    if (!id) return;
    if (!confirm('Remover este kit? Esta ação não pode ser desfeita.')) return;
    try {
      await fetchJSON('/api/kits/delete', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id }),
      });
      await load();
    } catch(e:any) {
      console.error(e);
      alert('Falha ao excluir');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-gray-800/60 bg-[#0c121a] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Kits</h2>
            <p className="text-sm text-gray-400">
              Cadastre kits de EPI (combinações de itens) e gerencie suas composições.
            </p>
          </div>
          <button onClick={onNew} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500">
            Novo kit
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e)=>{ setQ(e.target.value); setPage(1);}}
            placeholder="Buscar por nome..."
            className="w-full max-w-sm rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-600"
          />
          <select value={size} onChange={(e)=>{setSize(parseInt(e.target.value)||20); setPage(1);}}
            className="rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2 text-sm"
          >
            {[10,20,50,100].map(n=><option key={n} value={n}>{n}/pág</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-800/60">
        <table className="min-w-full divide-y divide-gray-800/60">
          <thead className="bg-[#0c121a]">
            <tr className="text-left text-sm text-gray-300">
              <th className="px-4 py-3">Kit</th>
              <th className="px-4 py-3">Composição</th>
              <th className="px-4 py-3">Atualizado</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 bg-[#0a0f16]">
            {!loading && rows.length===0 && (
              <tr><td className="px-4 py-6 text-sm text-gray-500" colSpan={4}>Nenhum registro encontrado.</td></tr>
            )}
            {rows.map((k) => (
              <tr key={k.id} className="text-sm">
                <td className="px-4 py-3 font-medium">{k.nome}</td>
                <td className="px-4 py-3 text-gray-300">
                  {k.itens && k.itens.length>0 ? (
                    <div className="flex max-w-xl flex-wrap gap-2">
                      {k.itens.map((it,idx)=>(
                        <span key={idx} className="rounded-full bg-slate-800/60 px-2 py-0.5 text-xs">
                          {it.itemNome} × {it.quantidade}
                        </span>
                      ))}
                    </div>
                  ) : <span className="text-gray-500">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-400">{k.updatedAt ? new Date(k.updatedAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={()=>onEdit(k)} className="rounded-md border border-gray-700 px-3 py-1.5 hover:bg-gray-800">Editar</button>
                    <button onClick={()=>onDelete(k.id)} className="rounded-md border border-red-900 bg-red-900/20 px-3 py-1.5 text-red-300 hover:bg-red-900/30">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <div>Página {page} de {totalPages} • Total: {total}</div>
        <div className="flex gap-2">
          <button disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1,p-1))} className="rounded-md border border-gray-700 px-3 py-1.5 disabled:opacity-40">Anterior</button>
          <button disabled={page>=totalPages} onClick={()=>setPage((p)=>Math.min(totalPages,p+1))} className="rounded-md border border-gray-700 px-3 py-1.5 disabled:opacity-40">Próxima</button>
        </div>
      </div>

      {/* Modal */}
      {open && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-800 bg-[#0b1118] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing.id ? 'Editar kit' : 'Novo kit'}</h3>
              <button onClick={onClose} className="rounded-md border border-gray-700 px-3 py-1.5 hover:bg-gray-800">Fechar</button>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-sm text-gray-400">Nome</label>
                <input value={editing.nome} onChange={(e)=>setEditing({...editing, nome: e.target.value})}
                  className="rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-600" />
              </div>
              <div className="grid gap-1">
                <label className="text-sm text-gray-400">Descrição</label>
                <textarea value={editing.descricao||''} onChange={(e)=>setEditing({...editing, descricao: e.target.value})}
                  className="min-h-[60px] rounded-lg border border-gray-800 bg-[#0a0f16] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-600" />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Composição do kit</span>
                  <button onClick={()=>setEditing({...editing, itens:[...(editing.itens||[]), { itemId: options[0]?.id || '', quantidade: 1 }]})}
                    className="rounded-md border border-gray-700 px-3 py-1.5 hover:bg-gray-800">
                    Adicionar item
                  </button>
                </div>

                <div className="rounded-lg border border-gray-800">
                  <table className="min-w-full divide-y divide-gray-800 text-sm">
                    <thead className="bg-[#0c121a]">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-left w-32">Quantidade</th>
                        <th className="px-3 py-2 text-right w-20">Remover</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {(editing.itens||[]).map((it,idx)=>(
                        <tr key={idx}>
                          <td className="px-3 py-2">
                            <select value={it.itemId} onChange={(e)=>{
                              const val = e.target.value;
                              const opt = options.find(o=>o.id===val);
                              const copy = [...(editing.itens||[])];
                              copy[idx] = { ...copy[idx], itemId: val, itemNome: opt?.nome || copy[idx].itemNome };
                              setEditing({...editing, itens: copy});
                            }} className="w-full rounded-md border border-gray-800 bg-[#0a0f16] px-2 py-1.5">
                              <option value="">Selecione...</option>
                              {options.map(o=>(<option key={o.id} value={o.id}>{o.nome}</option>))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} step={1} value={it.quantidade}
                              onChange={(e)=>{
                                const v = Number(e.target.value||0);
                                const copy = [...(editing.itens||[])];
                                copy[idx] = { ...copy[idx], quantidade: v };
                                setEditing({...editing, itens: copy});
                              }}
                              className="w-28 rounded-md border border-gray-800 bg-[#0a0f16] px-2 py-1.5" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={()=>{
                              const copy = [...(editing.itens||[])];
                              copy.splice(idx,1);
                              setEditing({...editing, itens: copy});
                            }} className="rounded-md border border-red-900 bg-red-900/20 px-3 py-1 text-red-300 hover:bg-red-900/30">Remover</button>
                          </td>
                        </tr>
                      ))}
                      {(!editing.itens || editing.itens.length===0) && (
                        <tr><td className="px-3 py-3 text-gray-500" colSpan={3}>Nenhum item no kit.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button onClick={onClose} className="rounded-md border border-gray-700 px-4 py-2 hover:bg-gray-800">Cancelar</button>
                <button onClick={onSave} className="rounded-md bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
