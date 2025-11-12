'use client';

import useSWR from 'swr';
import { useState, useMemo } from 'react';
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
      {replicateFrom && <ReplicateModal from={replicateFrom} onClose={() => setReplicateFrom(null)} onSaved={() => { setReplicateFrom(null); }} />}
    </div>
  );
}

async function removeKit(kit: Kit, mutate: any) {
  if (!confirm(`Excluir o kit "${kit.nome}"?`)) return;
  const res = await fetch('/api/kits/delete', { method: 'POST', body: JSON.stringify({ id: kit.id }) });
  if (!res.ok) { alert('Falha ao excluir'); return; }
  mutate();
}

// EditKitModal & ReplicateModal iguais ao v1 (mantidos no arquivo original do patch v1)
