'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

// Helpers importados da página Alterdata (vamos reusar as mesmas heurísticas de normalização/formatação)
function norm(s: string) {
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
}

function parseDate(s: any): string | null {
  if (!s) return null;
  const str = String(s).trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return f"{m[1]}-{m[2]}-{m[3]}";
  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return f"{m[3]}-{m[2]}-{m[1]}";
  m = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return f"{m[1]}-{m[2]}-{m[3]}";
  return null;
}
function fmtDateBR(s?: string|null) {
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function maskCPF(v: any) {
  const d = String(v||'').replace(/\D/g,'').slice(-11).padStart(11,'0');
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}
function padMatricula(v: any) {
  const d = String(v||'').replace(/\D/g,'').slice(-5).padStart(5,'0');
  return d;
}

type RowApi = { row_no: number; data: Record<string, any> };
type ApiRows = { ok: boolean; rows: RowApi[]; page: number; limit: number; total: number; error?: string };

type Colab = {
  source: 'alterdata'|'manual';
  cpf: string;
  matricula?: string|null;
  nome?: string|null;
  funcao?: string|null;
  unidade?: string|null;
  regional?: string|null;
  admissao?: string|null;
  demissao?: string|null;
};

async function fetchJSON(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  let json:any;
  try{ json = JSON.parse(text); }catch{ json = { ok:false, error:'JSON inválido', raw:text }; }
  return { json, headers: r.headers };
}

async function fetchAlterdataAll(): Promise<Colab[]> {
  // Vamos reaproveitar os endpoints raw-rows para montar a lista mínima necessária
  const { json: firstJ } = await fetchJSON('/api/alterdata/raw-rows?page=1&limit=200', { cache: 'force-cache' });
  if (!firstJ?.ok) return [];
  const first = firstJ as ApiRows;
  const total = first.total || first.rows.length;
  const limit = first.limit || 200;
  const pages = Math.max(1, Math.ceil(total / limit));
  const acc = [...first.rows];
  for (let p=2;p<=pages;p++){
    const { json } = await fetchJSON('/api/alterdata/raw-rows?page='+p+'&limit='+limit, { cache: 'force-cache' });
    if (json?.ok) acc.push(...(json.rows||[]));
  }
  // Detecta chaves
  const sample = acc[0]?.data || {};
  const keys = Object.keys(sample);
  const keyFor = (want: string[]) => {
    // encontra por score de substrings
    let best: string|null = null; let score = -1;
    for (const k of keys) {
      const n = norm(k);
      const s = want.reduce((t,w)=> t + (n.includes(w) ? 1 : 0), 0);
      if (s > score) { score = s; best = k; }
    }
    return best;
  };
  const kCPF = keyFor(['cpf']) || 'CPF';
  const kNome = keyFor(['nome']) || 'Nome';
  const kFunc = keyFor(['funcao','função','funca']) || 'Função';
  const kUnid = keyFor(['unidade','lotacao','lotação','setor','departamento','empresa','hospital']) || 'Unidade';
  const kReg  = keyFor(['regional']) || 'Regional';
  const kAdm  = keyFor(['admissao','admissão']) || 'Admissão';
  const kDem  = keyFor(['demissao','demissão','deslig']) || 'Demissão';

  const out: Colab[] = acc.map(r => {
    const d = r.data || {};
    return {
      source: 'alterdata' as const,
      cpf: String(d[kCPF]||'').replace(/\D/g,''),
      matricula: d[kNome] && d['Matrícula'] ? String(d['Matrícula']) : (d['Matricula']? String(d['Matricula']) : null),
      nome: d[kNome]? String(d[kNome]) : null,
      funcao: d[kFunc]? String(d[kFunc]) : null,
      unidade: d[kUnid]? String(d[kUnid]) : null,
      regional: d[kReg]? String(d[kReg]) : null,
      admissao: parseDate(d[kAdm]),
      demissao: parseDate(d[kDem]),
    };
  }).filter(x => x.cpf);

  return out;
}

async function fetchManualAll(): Promise<Colab[]> {
  const { json } = await fetchJSON('/api/entregas/manual', { cache: 'no-store' });
  if (!json?.ok) return [];
  const rows = (json.rows||[]) as any[];
  return rows.map(r => ({
    source: 'manual' as const,
    cpf: String(r.cpf||''),
    matricula: r.matricula? String(r.matricula): null,
    nome: r.nome? String(r.nome): null,
    funcao: r.funcao? String(r.funcao): null,
    unidade: r.unidade? String(r.unidade): null,
    regional: r.regional? String(r.regional): null,
    admissao: r.admissao? String(r.admissao).substring(0,10): null,
    demissao: r.demissao? String(r.demissao).substring(0,10): null,
  }));
}

async function fetchEpiMap(): Promise<Array<{funcao:string, epi:string, quantidade:number}>> {
  const { json } = await fetchJSON('/api/epi/map', { cache: 'force-cache' });
  if (!json?.ok) return [];
  return (json.rows||[]) as any[];
}

async function fetchDeliveries(cpf: string) {
  const { json } = await fetchJSON('/api/entregas/deliver?cpf='+encodeURIComponent(cpf), { cache: 'no-store' });
  if (!json?.ok) return [];
  return (json.rows||[]) as any[];
}

export default function EntregasPage(){
  const [list, setList] = useState<Colab[]>([]);
  const [loading, setLoading] = useState(false);
  const [epiMap, setEpiMap] = useState<Array<{funcao:string, epi:string, quantidade:number}>>([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ open: boolean, colab?: Colab|null }>({ open: false });
  const [form, setForm] = useState<any>({ cpf:'', nome:'', matricula:'', funcao:'', unidade:'', regional:'', admissao:'', demissao:'' });
  const [deliv, setDeliv] = useState<any[]>([]);
  const [deliverForm, setDeliverForm] = useState<{ item:string, qtd:number, data:string }>({ item:'', qtd:1, data: new Date().toISOString().substring(0,10) });

  useEffect(()=>{
    let on = true;
    (async ()=>{
      setLoading(true);
      const [alt, man, map] = await Promise.all([fetchAlterdataAll(), fetchManualAll(), fetchEpiMap()]);
      if (!on) return;
      setEpiMap(map);

      // Unifica por CPF (manual tem precedência para preencher campos vazios)
      const byCpf = new Map<string, Colab>();
      for (const x of alt) {
        byCpf.set(x.cpf, x);
      }
      for (const m of man) {
        const cur = byCpf.get(m.cpf);
        if (cur) byCpf.set(m.cpf, { ...cur, ...m }); else byCpf.set(m.cpf, m);
      }
      // Filtro: excluir demitidos antes de 2025
      const filtered: Colab[] = [];
      for (const c of byCpf.values()) {
        const dem = c.demissao ? Number((c.demissao||'').substring(0,4)) : null;
        if (dem && dem < 2025) continue;
        filtered.push(c);
      }
      setList(filtered.sort((a,b)=> (a.nome||'').localeCompare(b.nome||'', 'pt-BR')));
      setLoading(false);
    })();
    return ()=>{ on=false };
  }, []);

  const filtered = useMemo(()=>{
    if (!q.trim()) return list;
    const needles = q.toLowerCase().split(/\s+/).filter(Boolean);
    return list.filter(r => {
      const blob = [r.nome, r.cpf, r.matricula, r.funcao, r.unidade, r.regional].join(' ').toLowerCase();
      return needles.every(n => blob.includes(n));
    });
  }, [list, q]);

  function openNew(){
    setForm({ cpf:'', nome:'', matricula:'', funcao:'', unidade:'', regional:'', admissao:'', demissao:'' });
    setModal({ open: true, colab: null });
  }

  async function saveNew(){
    const body = { ...form };
    const { json } = await fetchJSON('/api/entregas/manual', { method:'POST', body: JSON.stringify(body), headers: { 'Content-Type':'application/json' } });
    if (json?.ok) {
      # reload list
      const man = await fetchManualAll();
      const alt = await fetchAlterdataAll();
      const byCpf = new Map<string, Colab>();
      for (const x of alt) byCpf.set(x.cpf, x);
      for (const m of man) {
        const cur = byCpf.get(m.cpf);
        if (cur) byCpf.set(m.cpf, { ...cur, ...m }); else byCpf.set(m.cpf, m);
      }
      const filtered: Colab[] = [];
      for (const c of byCpf.values()) {
        const dem = c.demissao ? Number((c.demissao||'').substring(0,4)) : null;
        if (dem && dem < 2025) continue;
        filtered.push(c);
      }
      setList(filtered.sort((a,b)=> (a.nome||'').localeCompare(b.nome||'', 'pt-BR')));
      setModal({ open: false });
    } else {
      alert('Erro ao salvar: ' + (json?.error||'desconhecido'));
    }
  }

  async function openDeliver(c: Colab){
    setDeliverForm({ item:'', qtd:1, data: new Date().toISOString().substring(0,10) });
    setModal({ open: true, colab: c });
    const rows = await fetchDeliveries(c.cpf);
    setDeliv(rows);
  }

  function kitFor(funcao?: string|null){
    const f = (funcao||'').trim().toLowerCase();
    return epiMap.filter(r => r.funcao.trim().toLowerCase() === f);
  }

  async function doDeliver(){
    if (!modal.colab) return;
    const body = {
      cpf: modal.colab.cpf,
      item: deliverForm.item,
      qty: Number(deliverForm.qtd||1),
      date: deliverForm.data,
      qty_required: kitFor(modal.colab.funcao).find(k => k.epi === deliverForm.item)?.quantidade || 1,
    };
    const { json } = await fetchJSON('/api/entregas/deliver', { method:'POST', body: JSON.stringify(body), headers:{'Content-Type':'application/json'} });
    if (json?.ok) {
      const rows = await fetchDeliveries(modal.colab.cpf);
      setDeliv(rows);
      # keep modal open
    } else {
      alert('Erro ao registrar entrega: '+(json?.error||'desconhecido'));
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">Entregas de EPI</div>
        <div className="ml-auto flex gap-2">
          <button className="px-3 py-2 rounded-xl bg-neutral-800 text-white" onClick={openNew}>Cadastro</button>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <input className="px-3 py-2 rounded-xl bg-neutral-100 text-sm w-full md:w-96 outline-none text-neutral-900"
               placeholder="Buscar por nome, CPF, matrícula, função, unidade..."
               value={q} onChange={e=>setQ(e.target.value)} />
        {loading && <span className="text-sm opacity-60">Carregando…</span>}
      </div>

      <div className="overflow-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr>
              <th className="px-3 py-2 text-left border-b">Nome</th>
              <th className="px-3 py-2 text-left border-b">CPF</th>
              <th className="px-3 py-2 text-left border-b">Matrícula</th>
              <th className="px-3 py-2 text-left border-b">Função</th>
              <th className="px-3 py-2 text-left border-b">Unidade</th>
              <th className="px-3 py-2 text-left border-b">Regional</th>
              <th className="px-3 py-2 text-left border-b">Admissão</th>
              <th className="px-3 py-2 text-left border-b">Demissão</th>
              <th className="px-3 py-2 text-left border-b"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={idx} className="odd:bg-neutral-50">
                <td className="px-3 py-2 whitespace-nowrap">{r.nome||''}</td>
                <td className="px-3 py-2 whitespace-nowrap">{maskCPF(r.cpf)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{padMatricula(r.matricula)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.funcao||''}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.unidade||''}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.regional||''}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDateBR(r.admissao)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDateBR(r.demissao)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button className="px-2 py-1 rounded border" onClick={()=>openDeliver(r)}>Entregar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de cadastro */}
      {modal.open && !modal.colab and (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 w-full max-w-2xl space-y-3">
            <div className="text-lg font-semibold">Novo colaborador (cadastro manual)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input placeholder="CPF" value={form.cpf} onChange={e=>setForm({...form, cpf:e.target.value})} className="input input-bordered px-3 py-2 rounded-xl bg-neutral-100"/>
              <input placeholder="Matrícula" value={form.matricula} onChange={e=>setForm({...form, matricula:e.target.value})} className="input input-bordered px-3 py-2 rounded-xl bg-neutral-100"/>
              <input placeholder="Nome" value={form.nome} onChange={e=>setForm({...form, nome:e.target.value})} className="input input-bordered px-3 py-2 rounded-xl bg-neutral-100"/>
              <input placeholder="Função" value={form.funcao} onChange={e=>setForm({...form, funcao:e.target.value})} className="input input-bordered px-3 py-2 rounded-xl bg-neutral-100"/>
              <input placeholder="Unidade" value={form.unidade} onChange={e=>setForm({...form, unidade:e.target.value})} className="input input-bordered px-3 py-2 rounded-xl bg-neutral-100"/>
              <input placeholder="Regional" value={form.regional} onChange={e=>setForm({...form, regional:e.target.value})} className="input input-bordered px-3 py-2 rounded-xl bg-neutral-100"/>
              <input placeholder="Admissão (dd/mm/aaaa)" value={form.admissao} onChange={e=>setForm({...form, admissao:e.target.value})} className="input input-bordered px-3 py-2 rounded-xl bg-neutral-100"/>
              <input placeholder="Demissão (dd/mm/aaaa)" value={form.demissao} onChange={e=>setForm({...form, demissao:e.target.value})} className="input input-bordered px-3 py-2 rounded-xl bg-neutral-100"/>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded-xl border" onClick={()=>setModal({open:false})}>Cancelar</button>
              <button className="px-3 py-2 rounded-xl bg-neutral-800 text-white" onClick={saveNew}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de entrega */}
      {modal.open && modal.colab && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 w-full max-w-3xl space-y-3">
            <div className="text-lg font-semibold">Registrar entrega — {modal.colab?.nome}</div>

            <div className="p-2 rounded-xl bg-neutral-50">
              <div className="font-medium text-sm">Kit esperado (função: {modal.colab?.funcao||'—'})</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {kitFor(modal.colab?.funcao).map((k, i) => {
                  const deliveredRow = deliv.find(d => d.item === k.epi);
                  const delivered = deliveredRow?.qty_delivered || 0;
                  return (
                    <div key={i} className="border rounded-xl p-2">
                      <div className="text-sm">{k.epi}</div>
                      <div className="text-xs opacity-70">Qtd esperada: {k.quantidade} • Entregue: {delivered}</div>
                    </div>
                  );
                })}
                {kitFor(modal.colab?.funcao).length === 0 && (
                  <div className="text-sm opacity-70">Nenhum kit mapeado para esta função.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className="px-3 py-2 rounded-xl bg-neutral-100"
                      value={deliverForm.item} onChange={e=>setDeliverForm({...deliverForm, item:e.target.value})}>
                <option value="">Selecione o EPI…</option>
                {kitFor(modal.colab?.funcao).map((k,i)=> <option key={i} value={k.epi}>{k.epi}</option>)}
              </select>
              <input className="px-3 py-2 rounded-xl bg-neutral-100" type="number" min={1}
                     value={deliverForm.qtd} onChange={e=>setDeliverForm({...deliverForm, qtd:Number(e.target.value)})} placeholder="Qtd"/>
              <input className="px-3 py-2 rounded-xl bg-neutral-100" type="date"
                     value={deliverForm.data} onChange={e=>setDeliverForm({...deliverForm, data:e.target.value})}/>
            </div>

            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded-xl border" onClick={()=>setModal({open:false})}>Fechar</button>
              <button className="px-3 py-2 rounded-xl bg-neutral-800 text-white"
                      disabled={!deliverForm.item || deliverForm.qtd<=0}
                      onClick={doDeliver}>Dar baixa</button>
            </div>

            <div className="mt-2">
              <div className="font-medium text-sm">Entregas registradas</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {deliv.map((d,i)=> (
                  <div key={i} className="border rounded-xl p-2">
                    <div className="text-sm">{d.item} — {d.qty_delivered} entregue(s)</div>
                    <div className="text-xs opacity-70">Lançamentos: {Array.isArray(d.deliveries) ? d.deliveries.map((x:any)=> `${x.qty} em ${x.date}`).join(', ') : ''}</div>
                  </div>
                ))}
                {deliv.length===0 && <div className="text-sm opacity-70">Nenhuma entrega lançada.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
