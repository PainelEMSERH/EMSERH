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
  ponto_reposicao?: number;
  [key: string]: any;
};

export default function EstoquePage() {
  const [regional, setRegional] = useState<string>('');

  const { data: lista } = useSWR(`/api/estoque/list?regional=${encodeURIComponent(regional || '')}`, fetcher);
  const { data: entradas } = useSWR(`/api/estoque/mov?regional=${encodeURIComponent(regional || '')}&tipo=entrada&days=30`, fetcher);
  const { data: saidas } = useSWR(`/api/estoque/mov?regional=${encodeURIComponent(regional || '')}&tipo=saida&days=30`, fetcher);

  const items: Item[] = useMemo(() => Array.isArray(lista) ? lista : (lista?.data ?? []), [lista]);

  function getMovCount(it: Item, bag: any): number {
    if (!bag) return 0;
    const arr = Array.isArray(bag) ? bag : (bag?.data ?? []);
    return arr.filter((m: any) => m.item_id === it.id || m.codigo === it.codigo || m.item === it.nome).reduce((acc: number, cur: any) => acc + Number(cur.quantidade || 0), 0);
  }

  function exportCSV() {
    const header = ['Item', 'Código', 'Saldo Atual', 'Entradas (30d)', 'Saídas (30d)', 'Ponto de Reposição'];
    const lines = items.map((it) => [
      it.nome || it.item || '',
      it.codigo || '',
      it.saldo ?? 0,
      getMovCount(it, entradas),
      getMovCount(it, saidas),
      it.ponto_reposicao ?? 0,
    ].join(';'));
    const csv = [header.join(';'), ...lines].join('\n');
    downloadBlob(`estoque_${regional || 'todas'}.csv`, csv);
  }

  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <h1 style={{ fontSize: '1.1rem', fontWeight: 500 }}>Estoque</h1>
        </div>
        <div className="row">
          <select className="select" value={regional} onChange={(e) => setRegional(e.target.value)}>
            <option value="">Regional (todas)</option>
            {/* Preencher dinamicamente, se houver endpoint; por ora livre */}
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
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
            {items.map((it) => {
              const entradas30 = getMovCount(it, entradas);
              const saidas30 = getMovCount(it, saidas);
              const abaixo = (it.saldo ?? 0) <= (it.ponto_reposicao ?? -1);
              return (
                <tr key={String(it.id || it.codigo)}>
                  <td>{it.nome || it.item}</td>
                  <td>{it.codigo || '-'}</td>
                  <td>{it.saldo ?? 0}</td>
                  <td>{entradas30}</td>
                  <td>{saidas30}</td>
                  <td>
                    <div className="row">
                      {abaixo ? <span className="badge-dot danger" title="Abaixo do ponto"></span> : <span className="badge-dot ok" title="Ok"></span>}
                      <span>{it.ponto_reposicao ?? 0}</span>
                    </div>
                  </td>
                  <td>
                    <div className="row">
                      <MovModalTrigger tipo="entrada" item={it} regional={regional} />
                      <MovModalTrigger tipo="saida" item={it} regional={regional} />
                      <HistoryLink item={it} regional={regional} />
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

function MovModalTrigger({ tipo, item, regional }: { tipo: 'entrada' | 'saida'; item: any; regional: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>{tipo === 'entrada' ? 'Entrada' : 'Saída'}</button>
      {open && <MovModal tipo={tipo} item={item} regional={regional} onClose={() => setOpen(false)} />}
    </>
  );
}

function MovModal({ tipo, item, regional, onClose }: { tipo: 'entrada' | 'saida'; item: any; regional: string; onClose: () => void }) {
  const [qtd, setQtd] = useState<number>(1);
  const [motivo, setMotivo] = useState<string>('');
  const [resp, setResp] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    try {
      setBusy(true);
      const payload = {
        tipo, quantidade: qtd, motivo, responsavel: resp,
        item_id: item.id, codigo: item.codigo, regional,
      };
      const res = await fetch('/api/estoque/mov', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Falha ao registrar movimentação');
      onClose();
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
          <h3 style={{ fontWeight: 500 }}>{tipo === 'entrada' ? 'Lançar Entrada' : 'Lançar Saída'}</h3>
          <button className="btn ghost" onClick={onClose}>Fechar</button>
        </div>
        <div className="grid cols-2" style={{ marginTop: '.75rem' }}>
          <div>
            <label>Quantidade</label>
            <input className="input" type="number" min={1} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} />
          </div>
          <div>
            <label>Responsável</label>
            <input className="input" value={resp} onChange={(e) => setResp(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label>Motivo</label>
            <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn ok" onClick={submit} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

function HistoryLink({ item, regional }: { item: any; regional: string }) {
  return <a className="btn ghost" href={`/estoque/historico?item=${encodeURIComponent(item.id || item.codigo || '')}&regional=${encodeURIComponent(regional || '')}`}>Histórico</a>;
}
