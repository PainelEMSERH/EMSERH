'use client';
import React, { useEffect, useMemo, useState } from 'react';

type MapItem = {
  alterdata_funcao: string;
  epi_item: string | null;
  quantidade: number | null;
  nome_site: string;
};

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
          mode: 'append' // append only
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

  const leftPanel = (
    <div className="w-full lg:w-[380px] xl:w-[420px] border rounded-2xl p-3 lg:p-4 bg-white/60 backdrop-blur">
      <div className="flex items-center gap-2 mb-3">
        <input
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
          placeholder="Buscar kit, função ou EPI..."
          className="w-full rounded-xl border px-3 py-2 outline-none"
        />
        <button
          onClick={load}
          className="rounded-xl border px-3 py-2 hover:bg-gray-50"
          title="Recarregar"
        >↻</button>
      </div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={onlyWithEPI} onChange={(e)=>setOnlyWithEPI(e.target.checked)} />
          Somente com EPI
        </label>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="text-sm rounded-xl border px-3 py-1.5 hover:bg-gray-50">Exportar CSV</button>
          <a href="/api/kits/map/template" className="text-sm rounded-xl border px-3 py-1.5 hover:bg-gray-50">Baixar Template</a>
        </div>
      </div>

      <div className="max-h-[68vh] overflow-auto pr-1 space-y-2">
        {loading && <div className="text-sm p-2">Carregando...</div>}
        {!loading && data.length === 0 && <div className="text-sm p-2">Nenhum kit encontrado.</div>}
        {data.map(g => (
          <button
            key={g.nome_site}
            onClick={() => setSelectedNomeSite(g.nome_site)}
            className={`w-full text-left border rounded-xl p-3 hover:bg-gray-50 transition ${
              selectedNomeSite === g.nome_site ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div className="font-medium">{g.nome_site}</div>
            <div className="text-xs text-gray-500 mt-1">
              {g.funcoesCount} função(ões) • {g.itensCount} item(ns)
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const rightPanel = selected ? (
    <div className="flex-1 border rounded-2xl p-4 bg-white/70 backdrop-blur">
      <div className="flex flex-col xl:flex-row gap-3 xl:items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{selected.nome_site}</h1>
          <p className="text-sm text-gray-500">
            {selected.funcoesCount} função(ões) mapeadas • {selected.itensCount} item(ns) no kit
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={editingNome}
            onChange={(e)=>setEditingNome(e.target.value)}
            placeholder="Novo nome do kit..."
            className="rounded-xl border px-3 py-2 outline-none"
          />
          <button onClick={renameKit} className="rounded-xl border px-3 py-2 hover:bg-gray-50">Renomear kit</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        {/* Itens do Kit */}
        <div className="border rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Itens do kit</h2>
            <div className="flex gap-2">
              <input
                value={newItem}
                onChange={(e)=>setNewItem(e.target.value)}
                placeholder="Novo item... (ex.: Máscara N95)"
                className="rounded-xl border px-3 py-2 outline-none"
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
                className="w-24 rounded-xl border px-3 py-2 outline-none"
              />
              <button
                onClick={addItem}
                disabled={!canSaveItem}
                className="rounded-xl border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
              >
                Incluir item
              </button>
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Item</th>
                  <th className="text-left px-3 py-2 w-24">Qtd</th>
                  <th className="text-right px-3 py-2 w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {selected.itens.map((it) => (
                  <tr key={it.epi_item} className="border-t">
                    <td className="px-3 py-2">{it.epi_item}</td>
                    <td className="px-3 py-2">{it.quantidade}</td>
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
        </div>

        {/* Funções Alterdata vinculadas */}
        <div className="border rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Funções (Alterdata)</h2>
            <div className="flex gap-2">
              <input
                value={newFuncao}
                onChange={(e)=>setNewFuncao(e.target.value)}
                placeholder="Nova função... (ex.: ENFERMEIRO UTI)"
                className="rounded-xl border px-3 py-2 outline-none"
              />
              <button onClick={addFuncao} className="rounded-xl border px-3 py-2 hover:bg-gray-50">
                Incluir função
              </button>
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Função (ALTERDATA)</th>
                  <th className="text-right px-3 py-2 w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {selected.funcoes.map((f) => (
                  <tr key={f} className="border-t">
                    <td className="px-3 py-2">{f}</td>
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
          <p className="text-xs text-gray-500 mt-2">
            Dica: se precisar diferenciar (ex.: <b>Enfermeiro</b> vs <b>Enfermeiro UTI</b>), mantenha kits distintos com <i>nome_site</i> diferentes.
          </p>
        </div>
      </div>

      {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
    </div>
  ) : (
    <div className="flex-1 border rounded-2xl p-4 bg-white/70 backdrop-blur grid place-items-center text-sm text-gray-500">
      Selecione um kit à esquerda para visualizar e editar.
    </div>
  );

  return (
    <div className="p-3 lg:p-4">
      <div className="mb-3">
        <h1 className="text-2xl font-semibold">Kits</h1>
        <p className="text-sm text-gray-600">Mapeamento entre Função (Alterdata) → Itens de EPI, com nome de exibição para o site.</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
        {leftPanel}
        {rightPanel}
      </div>
    </div>
  );
}
