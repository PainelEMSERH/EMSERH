'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { downloadBlob } from '@/lib/format';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);

type Item = {
  id?: string | number;
  nome?: string;
  item?: string;
  codigo?: string;
  saldo?: number;
  quantidade?: number;
  minimo?: number;
  maximo?: number;
  [key: string]: any;
};

function arr(v:any){ if(Array.isArray(v)) return v; if (Array.isArray(v?.rows)) return v.rows; if (Array.isArray(v?.data)) return v.data; return []; }

export default function EstoquePage() {
  const [regionalId, setRegionalId] = useState<string>('');

  const { data: lista } = useSWR(`/api/estoque/list?regionalId=${encodeURIComponent(regionalId || '')}`, fetcher);

  // Últimos 30 dias (rota espera de/ate em ISO)
  const now = new Date();
  const de = new Date(now.getTime() - 30*24*60*60*1000).toISOString();
  const ate = now.toISOString();

  const { data: entradas } = useSWR(`/api/estoque/mov?regionalId=${encodeURIComponent(regionalId || '')}&tipo=entrada&de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`, fetcher);
  const { data: saidas } = useSWR(`/api/estoque/mov?regionalId=${encodeURIComponent(regionalId || '')}&tipo=saida&de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`, fetcher);

  const items: Item[] = useMemo(() => arr(lista), [lista]);

  function getMovCount(it: Item, bag: any): number {
    const arrb = arr(bag);
    const id = it.itemId || it.id;
    return arrb.filter((m: any) => (m.itemId === id) || (m.codigo && m.codigo === it.codigo) || (m.item && (m.item === it.nome || m.item === it.item)))
               .reduce((acc: number, cur: any) => acc + Number(cur.quantidade || 0), 0);
  }

  function exportCSV() {
    const header = ['Item', 'Código', 'Saldo Atual', 'Entradas (30d)', 'Saídas (30d)', 'Ponto de Reposição'];
    const lines = items.map((it) => [
      it.nome || it.item || '',
      it.codigo || '',
      Number(it.quantidade ?? it.saldo ?? 0),
      getMovCount(it, entradas),
      getMovCount(it, saidas),
      Number(it.minimo ?? it.ponto_reposicao ?? 0),
    ].join(';'));
    const csv = [header.join(';'), ...lines].join('\n');
    downloadBlob(`estoque_${regionalId || 'todas'}.csv`, csv);
  }

  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <h1 style={{ fontSize: '1.1rem', fontWeight: 500 }}>Estoque</h1>
        </div>
        <div className="row">
          <input className="input" placeholder="RegionalId (opcional)" value={regionalId} onChange={(e) => setRegionalId(e.target.value)} />
          <button className="btn" onClick={exportCSV}>Exportar CSV</button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Código</th>
              <th>Saldo Atual</th>
              <th>Entradas (30d)</th>
              <th>Saídas (30d)</th>
              <th>Ponto de Reposição</th>
              <th style={{ width: 240 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const entradas30 = getMovCount(it, entradas);
              const saidas30 = getMovCount(it, saidas);
              const saldo = Number(it.quantidade ?? it.saldo ?? 0);
              const ponto = Number(it.minimo ?? it.ponto_reposicao ?? 0);
              const abaixo = saldo <= ponto;
              return (
                <tr key={String(it.id || it.codigo || idx)}>
                  <td>{it.nome || it.item}</td>
                  <td>{it.codigo || '-'}</td>
                  <td>{saldo}</td>
                  <td>{entradas30}</td>
                  <td>{saidas30}</td>
                  <td>
                    <div className="row">
                      {abaixo ? <span className="badge-dot danger" title="Abaixo do ponto"></span> : <span className="badge-dot ok" title="Ok"></span>}
                      <span>{ponto}</span>
                    </div>
                  </td>
                  <td>
                    <div className="row">
                      <a className="btn" href={`/estoque/mov?tipo=entrada&item=${encodeURIComponent(it.id || '')}`}>Entrada</a>
                      <a className="btn" href={`/estoque/mov?tipo=saida&item=${encodeURIComponent(it.id || '')}`}>Saída</a>
                      <a className="btn ghost" href={`/estoque/historico?item=${encodeURIComponent(it.id || it.codigo || '')}&regionalId=${encodeURIComponent(regionalId || '')}`}>Histórico</a>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={7} style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>Nenhum item</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
