'use client';

import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { formatDateBR, padMatricula } from '@/lib/format';

type Colab = {
  id?: string | number;
  matricula?: string | number;
  nome?: string;
  funcao?: string;
  unidade?: string;
  regional?: string;
  admissao?: string | Date | null;
  demissao?: string | Date | null;
  pendente?: boolean;
  [key: string]: any;
};

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);

type Props = { initialPageSize?: number; showDiagnostics?: boolean };

function getRows(obj: any): Colab[] {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj as Colab[];
  if (Array.isArray(obj.rows)) return obj.rows as Colab[];
  if (Array.isArray(obj.items)) return obj.items as Colab[];
  if (Array.isArray(obj.data)) return obj.data as Colab[];
  return [];
}
function getTotal(obj: any, fallbackLen: number): number {
  if (!obj) return fallbackLen;
  const keys = ['total', 'count', 'length'];
  for (const k of keys) {
    const v = (obj as any)[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return fallbackLen;
}

export default function EntregasTable({ initialPageSize = 50, showDiagnostics = false }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [regional, setRegional] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('');
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [search, setSearch] = useState('');

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    regional: regional || '',
    unidade: unidade || '',
    q: search || '',
    pending: String(somentePendentes),
  }).toString();

  // **Alvo principal**: /api/entregas/list retorna {rows,total,...}
  const { data: server } = useSWR(`/api/entregas/list?${query}`, fetcher);

  // Fallback: colaboradores/list => {rows,total} (não 'data')
  const { data: full } = useSWR(!server ? `/api/colaboradores/list?page=${page}&size=${pageSize}` : null, fetcher);

  const serverRows = getRows(server);
  const rows: Colab[] = useMemo(() => {
    if (serverRows.length) return serverRows;
    const all = getRows(full);
    let filtered = all;
    if (regional) filtered = filtered.filter((r) => (r.regional || '').toLowerCase().includes(regional.toLowerCase()));
    if (unidade) filtered = filtered.filter((r) => (r.unidade || '').toLowerCase().includes(unidade.toLowerCase()));
    if (search) filtered = filtered.filter((r) => (r.nome || '').toLowerCase().includes(search.toLowerCase()) || String(r.matricula || '').includes(search));
    if (somentePendentes) filtered = filtered.filter((r) => r.pendente === true || r.status === 'pendente');
    return filtered;
  }, [server, full, regional, unidade, somentePendentes, search]);

  const total: number = useMemo(() => {
    const sTotal = getTotal(server, rows.length);
    if (sTotal) return sTotal;
    return getTotal(full, rows.length);
  }, [server, full, rows]);

  const [selected, setSelected] = useState<Colab | null>(null);

  // Distintos (melhor esforço; se o backend paginar, os filtros refletem a página atual)
  const regionais = useMemo(() => {
    const all = serverRows.length ? serverRows : getRows(full);
    return Array.from(new Set(all.map((r: any) => r.regional).filter(Boolean))).sort();
  }, [server, full]);
  const unidades = useMemo(() => {
    const all = serverRows.length ? serverRows : getRows(full);
    const set = new Set<string>();
    all.forEach((r: any) => { if (!regional || r.regional === regional) set.add(r.unidade); });
    return Array.from(set).filter(Boolean).sort();
  }, [server, full, regional]);

  return (
    <div className="grid" style={{ gap: '1rem' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <h1 style={{ fontSize: '1.1rem', fontWeight: 500 }}>Entregas</h1>
          <span className="pill" title="Total de colaboradores carregados">Total: {Intl.NumberFormat('pt-BR').format(total)}</span>
          {somentePendentes && <span className="pill warn">Somente Pendentes</span>}
        </div>
        <div className="row">
          <input className="input" placeholder="Buscar por nome ou matrícula" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="select" value={regional} onChange={(e) => { setRegional(e.target.value); setUnidade(''); setPage(1); }}>
            <option value="">Regional (todas)</option>
            {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="select" value={unidade} onChange={(e) => { setUnidade(e.target.value); setPage(1); }} disabled={!regional}>
            <option value="">Unidade (todas)</option>
            {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <label className="row" style={{ gap: '.5rem' }}>
            <input type="checkbox" checked={somentePendentes} onChange={(e) => { setSomentePendentes(e.target.checked); setPage(1); }} />
            Somente Pendentes
          </label>
        </div>
      </div>

      {showDiagnostics && (
        <div className="card" style={{ padding: '.75rem' }}>
          <div style={{ fontSize: '.85rem', color: '#a3a3a3' }}>
            <div><b>/api/entregas/list</b> keys: {server ? Object.keys(server).join(', ') : '—'}</div>
            <div><b>rows</b> detectadas: {serverRows.length}</div>
          </div>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Matrícula</th>
              <th>Nome</th>
              <th>Função</th>
              <th>Unidade</th>
              <th>Regional</th>
              <th>Admissão</th>
              <th>Demissão</th>
              <th style={{ width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={String(r.id || r.matricula || idx)}>
                <td>{padMatricula(r.matricula ?? '')}</td>
                <td>
                  <div className="row">
                    {r.pendente ? <span className="badge-dot danger" title="Pendência"></span> : null}
                    <span>{r.nome}</span>
                  </div>
                </td>
                <td>{r.funcao}</td>
                <td>{r.unidade}</td>
                <td>{r.regional}</td>
                <td>{formatDateBR(r.admissao)}</td>
                <td>{formatDateBR(r.demissao)}</td>
                <td>
                  <button className="btn primary" onClick={() => setSelected(r)}>Entregar</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>Nenhum registro</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: '.5rem' }}>
        <select className="select" style={{ width: 120 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}/página</option>)}
        </select>
        <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button>
        <span className="kpi">Página {page}</span>
        <button className="btn" onClick={() => setPage((p) => p + 1)}>Próxima</button>
      </div>

      {selected && <KitModal colaborador={selected} onClose={() => setSelected(null)} onDelivered={() => setSelected(null)} />}
    </div>
  );
}

// (igual ao v1) — modal simplificado
function KitModal({ colaborador, onClose, onDelivered }: { colaborador: Colab; onClose: () => void; onDelivered: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [kit, setKit] = useState<any>(null);
  const funcao = colaborador?.funcao || '';

  useEffect(() => {
    let mounted = true;
    fetch(`/api/entregas/kit?funcao=${encodeURIComponent(funcao)}`)
      .then((r) => r.json())
      .then((j) => { if (mounted) setKit(j?.kit ?? j); })
      .catch(() => { if (mounted) setKit([]); });
    return () => { mounted = false; };
  }, [funcao]);

  async function confirmarEntrega() {
    try {
      setSubmitting(true);
      const payload = {
        matricula: colaborador.matricula,
        colaborador_id: colaborador.id,
        funcao: colaborador.funcao,
        unidade: colaborador.unidade,
        regional: colaborador.regional,
        itens: (kit?.itens || kit || []).map((i: any) => ({ id: i.id, item: i.nome || i.item, quantidade: i.quantidade ?? 1 })),
      };
      const res = await fetch('/api/entregas/deliver', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Falha ao registrar entrega');
      onDelivered();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 500 }}>Entrega de EPI — {colaborador?.nome}</h2>
          <button className="btn ghost" onClick={onClose}>Fechar</button>
        </div>
        <div style={{ marginTop: '.75rem' }}>
          <div className="kpi">Função: {funcao} • Unidade: {colaborador?.unidade} • Regional: {colaborador?.regional}</div>
          <div className="card" style={{ marginTop: '.75rem' }}>
            <table className="table">
              <thead>
                <tr><th>Item</th><th style={{ width: 120, textAlign: 'right' }}>Qtd</th></tr>
              </thead>
              <tbody>
                {(kit?.itens || kit || []).map((i: any, idx: number) => (
                  <tr key={idx}><td>{i.nome || i.item}</td><td style={{ textAlign: 'right' }}>{i.quantidade ?? 1}</td></tr>
                ))}
                {(!kit || (kit?.itens || kit).length === 0) && <tr><td colSpan={2} style={{ color: '#999', textAlign: 'center', padding: '1rem' }}>Sem itens configurados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button className="btn ok" onClick={confirmarEntrega} disabled={submitting}>{submitting ? 'Confirmando…' : 'Confirmar entrega'}</button>
        </div>
      </div>
    </div>
  );
}
