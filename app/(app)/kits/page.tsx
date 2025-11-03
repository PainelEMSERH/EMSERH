'use client';
import React, { useEffect, useMemo, useState } from 'react';

/**
 * Redesigned Kits page:
 * - Clean, professional layout
 * - Neutral palette + subtle accent
 * - Better spacing, typography and hierarchy
 * - Responsive (drawer-like behavior on mobile)
 * - Sticky header on tables, soft shadows, rounded-2xl cards
 * - Non-intrusive actions with confirmations
 */

type KitGroup = {
  nome_site: string;
  funcoes: string[];
  itens: { epi_item: string; quantidade: number }[];
  funcoesCount: number;
  itensCount: number;
};

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, cache: 'no-store' });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${msg || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export default function KitsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyWithEPI, setOnlyWithEPI] = useState(false);
  const [data, setData] = useState<KitGroup[]>([]);
  const [selectedNomeSite, setSelectedNomeSite] = useState<string | null>(null);
  const [selected, setSelected] = useState<KitGroup | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJSON<{ data: KitGroup[] }>('/api/kits/map?grouped=1');
      let groups = result.data;
      if (query.trim()) {
        const q = query.toLowerCase();
        groups = groups.filter(g =>
          g.nome_site.toLowerCase().includes(q) ||
          g.funcoes.some(f => f.toLowerCase().includes(q)) ||
          g.itens.some(i => i.epi_item.toLowerCase().includes(q))
        );
      }
      if (onlyWithEPI) {
        groups = groups.filter(g => g.itens.some(i => i.epi_item.toLowerCase() !== 'sem epi'));
      }
      groups.sort((a,b)=>a.nome_site.localeCompare(b.nome_site));
      setData(groups);
      if (selectedNomeSite) {
        const s = groups.find(g => g.nome_site === selectedNomeSite) || null;
        setSelected(s);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const s = data.find(g => g.nome_site === selectedNomeSite) || null;
    setSelected(s);
  }, [data, selectedNomeSite]);

  // Local form states
  const [editingNome, setEditingNome] = useState('');
  const [newFuncao, setNewFuncao] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newQtd, setNewQtd] = useState<number | ''>('');

  const canSaveItem = selected && newItem.trim() && newQtd !== '';

  async function renameKit() {
    if (!selected || !editingNome.trim() || editingNome === selected.nome_site) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJSON('/api/kits/map/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: selected.nome_site, newName: editingNome.trim() }),
      });
      setSelectedNomeSite(editingNome.trim());
      setEditingNome('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao renomear');
    } finally {
      setLoading(false);
    }
  }

  async function addFuncao() {
    if (!selected || !newFuncao.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJSON('/api/kits/map/add-funcao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_site: selected.nome_site,
          alterdata_funcao: newFuncao.trim(),
        }),
      });
      setNewFuncao('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao incluir função');
    } finally {
      setLoading(false);
    }
  }

  async function addItem() {
    if (!selected || !canSaveItem) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJSON('/api/kits/map/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_site: selected.nome_site,
          funcoes: selected.funcoes,
          itens: [{ epi_item: newItem.trim(), quantidade: Number(newQtd) }],
          mode: 'append'
        }),
      });
      setNewItem('');
      setNewQtd('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao incluir item');
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(epi_item: string) {
    if (!selected) return;
    const ok = window.confirm(`Remover o item “${epi_item}” do kit?`);
    if (!ok) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJSON('/api/kits/map/remove-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_site: selected.nome_site,
          epi_item,
        }),
      });
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao remover item');
    } finally {
      setLoading(false);
    }
  }

  async function removeFuncao(alterdata_funcao: string) {
    if (!selected) return;
    const ok = window.confirm(`Remover a função “${alterdata_funcao}” deste kit?`);
    if (!ok) return;
    setLoading(true);
    setError(null);
    try {
      await fetchJSON('/api/kits/map/remove-funcao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_site: selected.nome_site,
          alterdata_funcao,
        }),
      });
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao remover função');
    } finally {
      setLoading(false);
    }
  }

  async function exportCSV() {
    try {
      const res = await fetch('/api/kits/map/export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stg_epi_map.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kits de EPI</h1>
            <p className="text-sm text-slate-600 mt-1">
              Mapeamento entre <span className="font-medium">Função (Alterdata)</span> e <span className="font-medium">Itens de EPI</span>, agrupado por <span className="font-medium">nome de exibição do site</span>.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 shadow-sm">Exportar CSV</button>
            <a href="/api/kits/map/template" className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-700 shadow-sm">Baixar Template</a>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-4">
        {/* Sidebar */}
        <aside className="bg-white rounded-2xl border shadow-sm p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
                placeholder="Buscar por kit, função ou item..."
                className="w-full rounded-xl border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <button
              onClick={() => {
                setQuery(q => q.trim());
                setData(d => [...d]);
              }}
              className="px-3 py-2 rounded-xl border bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
              title="Aplicar filtro"
            >
              Buscar
            </button>
          </div>

          <div className="flex items-center justify-between mt-3">
            <label className="text-sm text-slate-600 flex items-center gap-2">
              <input type="checkbox" className="accent-slate-900" checked={onlyWithEPI} onChange={(e)=>setOnlyWithEPI(e.target.checked)} />
              Somente kits com EPI
            </label>
            <button
              onClick={() => { setQuery(''); setOnlyWithEPI(false); load(); }}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Limpar
            </button>
          </div>

          <div className="mt-3 h-[67vh] overflow-auto pr-1 space-y-2">
            {loading && <div className="text-sm p-2 text-slate-500">Carregando...</div>}
            {!loading && data.length === 0 && <div className="text-sm p-2 text-slate-500">Nenhum kit encontrado.</div>}
            {data.map(g => (
              <button
                key={g.nome_site}
                onClick={() => setSelectedNomeSite(g.nome_site)}
                className={`w-full text-left rounded-xl border bg-white hover:bg-slate-50 transition shadow-sm px-3 py-2 ${
                  selectedNomeSite === g.nome_site ? 'ring-2 ring-slate-900' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-900 truncate">{g.nome_site}</div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border">{g.funcoesCount} função(ões)</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border">{g.itensCount} item(ns)</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Content */}
        <section className="min-h-[70vh]">
          {!selected ? (
            <div className="bg-white rounded-2xl border shadow-sm h-full grid place-items-center text-slate-500">
              Selecione um kit à esquerda para visualizar e editar.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Kit Header Card */}
              <div className="bg-white rounded-2xl border shadow-sm p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{selected.nome_site}</h2>
                    <p className="text-sm text-slate-600">{selected.funcoesCount} função(ões) • {selected.itensCount} item(ns)</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={editingNome}
                      onChange={(e)=>setEditingNome(e.target.value)}
                      placeholder="Novo nome do kit"
                      className="rounded-xl border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                    />
                    <button
                      onClick={renameKit}
                      className="px-3 py-2 rounded-xl border bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                    >
                      Renomear
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Items card */}
                <div className="bg-white rounded-2xl border shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-medium text-slate-900">Itens do kit</h3>
                    <div className="flex gap-2">
                      <input
                        value={newItem}
                        onChange={(e)=>setNewItem(e.target.value)}
                        placeholder="Ex.: Máscara N95"
                        className="rounded-xl border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                      />
                      <input
                        value={newQtd}
                        onChange={(e)=>{
                          const v = e.target.value;
                          if (v === '') return setNewQtd('');
                          const num = Number(v);
                          if (!Number.isNaN(num)) setNewQtd(num);
                        }}
                        placeholder="Qtd"
                        className="w-24 rounded-xl border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                      />
                      <button
                        onClick={addItem}
                        disabled={!canSaveItem}
                        className="px-3 py-2 rounded-xl border bg-slate-900 hover:bg-slate-800 text-white shadow-sm disabled:opacity-50"
                      >
                        Incluir
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="text-slate-700">
                          <th className="text-left px-3 py-2">Item</th>
                          <th className="text-left px-3 py-2 w-24">Qtd</th>
                          <th className="text-right px-3 py-2 w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.itens.map((it, idx) => (
                          <tr key={it.epi_item} className={idx % 2 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="px-3 py-2 text-slate-900">{it.epi_item}</td>
                            <td className="px-3 py-2 text-slate-900">{it.quantidade}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={()=>removeItem(it.epi_item)}
                                className="text-red-600 hover:underline"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Itens “SEM EPI” são tratados como quantidade 0.</p>
                </div>

                {/* Functions card */}
                <div className="bg-white rounded-2xl border shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-medium text-slate-900">Funções (Alterdata)</h3>
                    <div className="flex gap-2">
                      <input
                        value={newFuncao}
                        onChange={(e)=>setNewFuncao(e.target.value)}
                        placeholder="Ex.: ENFERMEIRO UTI"
                        className="rounded-xl border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                      />
                      <button
                        onClick={addFuncao}
                        className="px-3 py-2 rounded-xl border bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                      >
                        Incluir
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr className="text-slate-700">
                          <th className="text-left px-3 py-2">Função (ALTERDATA)</th>
                          <th className="text-right px-3 py-2 w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.funcoes.map((f, idx) => (
                          <tr key={f} className={idx % 2 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="px-3 py-2 text-slate-900">{f}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={()=>removeFuncao(f)}
                                className="text-red-600 hover:underline"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Para separar kits (ex.: Enfermeiro vs Enfermeiro UTI), mantenha <span className="font-medium">nome_site</span> diferentes.</p>
                </div>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
