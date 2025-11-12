'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { summarizeItems } from '@/lib/format';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
function arr(v:any){ if(Array.isArray(v)) return v; if (Array.isArray(v?.rows)) return v.rows; if (Array.isArray(v?.data)) return v.data; return []; }

type Kit = {
  id?: string | number;
  nome?: string;
  funcao?: string;
  itens?: Array<{ id?: string | number; nome?: string; item?: string; quantidade?: number }>;
  updatedAt?: string | Date;
  [key: string]: any;
};

export default function KitsPage() {
  const { data, mutate } = useSWR('/api/kits/list', fetcher);
  const kits: Kit[] = useMemo(() => arr(data), [data]);

  const [editing, setEditing] = useState<Kit | null>(null);
  const [replicateFrom, setReplicateFrom] = useState<Kit | null>(null);

  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 500 }}>Kits</h1>
        <button className="btn ok" onClick={() => setEditing({ nome: '', funcao: '', itens: [] })}>Novo Kit</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome do Kit</th>
              <th>Função</th>
              <th>Itens</th>
              <th>Última atualização</th>
              <th style={{ width: 240 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {kits.map((k, idx) => (
              <tr key={String(k.id || idx)}>
                <td>{k.nome}</td>
                <td>{k.funcao}</td>
                <td>{summarizeItems(k.itens || k.composicao || [])}</td>
                <td>{k.updatedAt ? new Date(k.updatedAt).toLocaleString('pt-BR') : '-'}</td>
                <td>
                  <div className="row">
                    <button className="btn" onClick={() => setEditing(k)}>Editar</button>
                    <button className="btn danger" onClick={() => removeKit(k, mutate)}>Excluir</button>
                    <button className="btn" onClick={() => setReplicateFrom(k)}>Replicar</button>
                  </div>
                </td>
              </tr>
            ))}
            {kits.length === 0 && <tr><td colSpan={5} style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>Nenhum kit</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && <EditKitModal kit={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); mutate(); }} />}
      {replicateFrom && <ReplicateModal from={replicateFrom} onClose={() => setReplicateFrom(null)} onSaved={() => { setReplicateFrom(null); mutate(); }} />}
    </div>
  );
}

async function removeKit(kit: Kit, mutate: any) {
  if (!confirm(`Excluir o kit "${kit.nome}"?`)) return;
  const res = await fetch('/api/kits/delete', { method: 'POST', body: JSON.stringify({ id: kit.id }) });
  if (!res.ok) { alert('Falha ao excluir'); return; }
  mutate();
}

function EditKitModal({ kit, onClose, onSaved }: { kit: Kit; onClose: () => void; onSaved: () => void }) {
  const [state, setState] = useState<Kit>({ ...kit, itens: kit.itens ? [...kit.itens] : [] });
  const [busy, setBusy] = useState(false);

  function addItem() {
    setState((s) => ({ ...s, itens: [...(s.itens || []), { nome: '', quantidade: 1 }] }));
  }
  function updateItem(idx: number, field: string, value: any) {
    setState((s) => {
      const itens = [...(s.itens || [])];
      itens[idx] = { ...(itens[idx] || {}), [field]: value };
      return { ...s, itens };
    });
  }
  function removeItem(idx: number) {
    setState((s) => {
      const itens = [...(s.itens || [])];
      itens.splice(idx, 1);
      return { ...s, itens };
    });
  }

  async function save() {
    try {
      setBusy(true);
      const res = await fetch('/api/kits/upsert', { method: 'POST', body: JSON.stringify(state) });
      if (!res.ok) throw new Error('Falha ao salvar');
      onSaved();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 500 }}>{state.id ? 'Editar Kit' : 'Novo Kit'}</h3>
          <button className="btn ghost" onClick={onClose}>Fechar</button>
        </div>
        <div className="grid cols-2" style={{ marginTop: '.75rem' }}>
          <div>
            <label>Nome do Kit</label>
            <input className="input" value={state.nome || ''} onChange={(e) => setState({ ...state, nome: e.target.value })} />
          </div>
          <div>
            <label>Função</label>
            <input className="input" value={state.funcao || ''} onChange={(e) => setState({ ...state, funcao: e.target.value })} />
          </div>
        </div>

        <div style={{ marginTop: '.75rem' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h4 style={{ fontWeight: 500 }}>Itens do Kit</h4>
            <button className="btn" onClick={addItem}>Adicionar Item</button>
          </div>
          <div className="card" style={{ marginTop: '.5rem' }}>
            <table className="table">
              <thead><tr><th>Item</th><th style={{ width: 180 }}>Quantidade</th><th style={{ width: 60 }}></th></tr></thead>
              <tbody>
                {(state.itens || []).map((it, idx) => (
                  <tr key={idx}>
                    <td><input className="input" value={it.nome || it.item || ''} onChange={(e) => updateItem(idx, 'nome', e.target.value)} /></td>
                    <td><input className="input" type="number" min={1} value={it.quantidade ?? 1} onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))} /></td>
                    <td><button className="btn danger" onClick={() => removeItem(idx)}>Remover</button></td>
                  </tr>
                ))}
                {(state.itens || []).length === 0 && <tr><td colSpan={3} style={{ color: '#999', textAlign: 'center', padding: '1rem' }}>Sem itens</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn ok" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

function ReplicateModal({ from, onClose, onSaved }: { from: Kit; onClose: () => void; onSaved: () => void }) {
  const [regionais, setRegionais] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function replicate() {
    try {
      setBusy(true);
      const res = await fetch('/api/kits/upsert', { method: 'POST', body: JSON.stringify({ ...from, regional: regionais }) });
      if (!res.ok) throw new Error('Falha ao replicar');
      onSaved();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 500 }}>Replicar Kit</h3>
          <button className="btn ghost" onClick={onClose}>Fechar</button>
        </div>
        <div style={{ marginTop: '.75rem' }}>
          <label>Regional destino</label>
          <input className="input" value={regionais} onChange={(e) => setRegionais(e.target.value)} placeholder="Ex.: Sul, Norte..." />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn ok" onClick={replicate} disabled={busy}>{busy ? 'Replicando…' : 'Replicar'}</button>
        </div>
      </div>
    </div>
  );
}
