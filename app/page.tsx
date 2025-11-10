// AUTO-GENERATED: entregas page - SWR-based (simplified)
// NOTE: This is a best-effort replacement. Review styling/icons/components to match your app shell.
'use client';
import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (u) => fetch(u).then(r => r.json());

function formatDateBR(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const dd = String(dt.getDate()).padStart(2,'0');
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const matriculaFmt = (m) => String(m||'').padStart(5,'0');
const regionalFmt = (r) => r ? (r.toString().startsWith('R') ? r : `R${r}`) : '';

export default function EntregasPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState('');
  const [regional, setRegional] = useState('');
  const [unidade, setUnidade] = useState('');

  const qs = new URLSearchParams();
  if (regional) qs.set('regional', regional);
  if (unidade) qs.set('unidade', unidade);
  if (q) qs.set('q', q);
  qs.set('page', String(page));
  qs.set('pageSize', String(pageSize));
  const key = `/api/entregas/list?${qs.toString()}`;

  const { data, error, isValidating, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  const rows = data?.rows || [];
  const total = data?.total || 0;

  useEffect(() => {
    // nothing for now
  }, [data]);

  const confirmarEntrega = async (id) => {
    // optimistic update: mark as delivered (simple flag)
    const prev = data;
    const newRows = rows.map(r => r.id === id ? {...r, delivered: true} : r);
    mutate({...data, rows: newRows}, false);
    try {
      await fetch('/api/entregas/deliver', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id}) });
      mutate(); // revalidate
    } catch (e) {
      // rollback
      mutate(prev, false);
      console.error(e);
    }
  };

  return (
    <div className="p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-medium">Entregas</h1>
        <div className="text-sm text-muted">Total: {total}</div>
      </header>

      <div className="mb-4 flex gap-2">
        <input placeholder="Pesquisar..." value={q} onChange={(e)=>setQ(e.target.value)} className="p-2 rounded border bg-transparent" />
        <button onClick={()=>setPage(1)} className="px-3 py-2 rounded border">Buscar</button>
      </div>

      <div className="overflow-auto bg-[#0b0b0b] rounded p-2">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>Matr.</th>
              <th>Nome</th>
              <th>Função</th>
              <th>Unidade</th>
              <th>Regional</th>
              <th>Admissão</th>
              <th>Demissão</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b">
                <td>{matriculaFmt(r.matricula)}</td>
                <td className="flex items-center gap-2">
                  {r.delivered ? <span title="Entregue" style={{width:10,height:10,background:'green',borderRadius:10,display:'inline-block'}} /> : null}
                  {r.nome}
                </td>
                <td>{r.funcao}</td>
                <td>{r.unidade}</td>
                <td>{regionalFmt(r.regional)}</td>
                <td>{formatDateBR(r.admissao)}</td>
                <td>{formatDateBR(r.demissao)}</td>
                <td>
                  <button onClick={()=>confirmarEntrega(r.id)} className="px-2 py-1 rounded border">Entregar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="mt-4 flex justify-between items-center">
        <div>Page {page}</div>
        <div className="flex gap-2">
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 rounded border">Prev</button>
          <button onClick={()=>setPage(p=>p+1)} className="px-2 py-1 rounded border">Next</button>
        </div>
      </footer>
    </div>
  );
}
