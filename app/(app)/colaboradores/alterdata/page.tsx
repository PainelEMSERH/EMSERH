'use client';
import React, { useEffect, useMemo, useState } from 'react';

type Row = { row_no: number; data: Record<string,string> };
type ApiRows = { ok: boolean; rows: Row[]; page: number; limit: number; total: number; error?: string };
type ApiCols = { ok: boolean; columns: string[]; error?: string };

type UnidadeMap = { unidade: string; regional: string };

// === Helpers (somente visual) ===
function stripAccents(s: string){ return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function norm(s: string){ return stripAccents(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function formatDateBR(value: string){
  if(!value) return '';
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(!m) return value;
  const [, y, mo, d, hh, mm] = m;
  const ddmmyyyy = `${d}/${mo}/${y}`;
  if(hh && !(hh === '00' && (mm||'00') === '00')) return `${ddmmyyyy} ${hh}:${mm||'00'}`;
  return ddmmyyyy;
}

function formatCPF(value: string){
  if(!value) return '';
  const digitsRaw = value.replace(/\D/g,'');
  const digits = digitsRaw.padStart(11,'0').slice(-11);
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

function formatMatricula(value: string){
  if(!value) return '';
  const digits = value.replace(/\D/g,'');
  if(!digits) return value;
  return digits.padStart(5,'0');
}

function formatTelefoneBR(value: string){
  if(!value) return '';
  const d = value.replace(/\D/g,'');
  if(d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  if(d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return value;
}

function formatCell(col: string, raw?: string){
  const value = (raw ?? '').trim();
  if(!value) return '';
  const c = norm(col);

  if(c.includes('cpf')) return formatCPF(value);
  if(c.includes('matricul')) return formatMatricula(value);

  // datas comuns: Admissão, Nascimento, Demissão, Atestado, Início/Fim Afastamento, Próximo ASO etc.
  if (c.startsWith('data') || c.includes('admiss') || c.includes('demiss') || c.includes('nasc') || c.includes('atest') || c.includes('afast') || (c.includes('aso') && (c.includes('prox') || c.includes('proxim')))) {
    return formatDateBR(value);
  }

  if(c.includes('celular') || c.includes('telefone') || c.endsWith('fone')){
    return formatTelefoneBR(value);
  }

  return value;
}
// === /Helpers ===

export default function AlterdataCompletaPage(){
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Unidades ↔ Regional (para join visual)
  const [unidades, setUnidades] = useState<UnidadeMap[]>([]);
  const regionalLookup = useMemo(()=>{
    const map = new Map<string,string>();
    for(const u of unidades){
      map.set(norm(u.unidade), u.regional);
    }
    return map;
  },[unidades]);

  // Filtros
  const [fRegional, setFRegional] = useState('');
  const [fUnidade, setFUnidade] = useState('');
  const [fStatus, setFStatus] = useState(''); // Demitido, Admitido, Afastado, + tipos de ASO comuns

  // Detectar coluna 'Unidade' no Alterdata
  const unidadeCol = useMemo(()=>{
    const ncols = cols.map(c=>norm(c));
    const candid = [
      'unidadehospitalar','unidade','departamento','nmddepartamento','setor','lotacao','local'
    ];
    for(const cand of candid){
      const idx = ncols.findIndex(n => n.includes(cand));
      if(idx >= 0) return cols[idx];
    }
    // fallback por prefixo
    for(const c of cols){
      const n = norm(c);
      if(n.startsWith('unid') || n.includes('depart')) return c;
    }
    return '';
  },[cols]);

  // Carregar colunas
  useEffect(()=>{
    let on = true;
    (async ()=>{
      const r = await fetch('/api/alterdata/raw-columns');
      const j: ApiCols = await r.json();
      if(on && j.ok){
        // Ocultar colunas só no visual
        const hide = (col:string)=>{
          const n = norm(col);
          return (
            n.includes('celular') ||
            n.includes('telefone') || n.endsWith('fone') ||
            n.includes('cidade') ||
            n.includes('estadocivil') ||
            n.includes('medico') ||
            n.includes('periodicid')
          );
        };
        let filtered = (j.columns || []).filter(c => !hide(c));
        // Garante a coluna derivada
        if(!filtered.includes('Regional responsável')){
          filtered.push('Regional responsável');
        }
        setCols(filtered);
      }
    })();
    return ()=>{ on=false; };
  }, []);

  // Carregar mapeamento Unidade→Regional
  useEffect(()=>{
    let on = true;
    (async ()=>{
      try{
        // preferencial: endpoint de colaboradores/unidades (lista completa da tabela stg_unid_reg)
        let r = await fetch('/api/colaboradores/unidades');
        let j = await r.json();
        let list: UnidadeMap[] = [];
        if(Array.isArray(j?.unidades)){
          list = j.unidades as UnidadeMap[];
        }else{
          // fallback: entregas/options
          const r2 = await fetch('/api/entregas/options');
          const j2 = await r2.json();
          if(Array.isArray(j2?.unidades)) list = j2.unidades as UnidadeMap[];
        }
        if(on) setUnidades(list);
      }catch{
        /* ignore */
      }
    })();
    return ()=>{ on=false; };
  }, []);

  // Carregar linhas (paginado)
  useEffect(()=>{
    let on = true;
    setLoading(true);
    (async ()=>{
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if(q.trim()) params.set('q', q.trim());
      const r = await fetch(`/api/alterdata/raw-rows?${params.toString()}`);
      const j: ApiRows = await r.json();
      if(on){
        if(j.ok){
          setRows(j.rows);
          setTotal(j.total);
        }else{
          console.error(j.error);
        }
        setLoading(false);
      }
    })();
    return ()=>{ on=false; };
  }, [page, limit, q]);

  // Derivações por linha
  const getRegionalOfRow = (r: Row)=>{
    const unidadeValor = unidadeCol ? (r.data?.[unidadeCol] || '') : '';
    return regionalLookup.get(norm(unidadeValor)) || '';
  };
  const getTipoAso = (r: Row)=>{
    const entry = Object.entries(r.data||{}).find(([k]) => {
      const n = norm(k);
      return n === 'tipodeaso' || n.includes('tipodeaso') || (n.includes('aso') && n.includes('tipo'));
    });
    return entry ? entry[1] : '';
  };
  const hasAfastamentoAtivo = (r: Row)=>{
    const ini = Object.entries(r.data||{}).find(([k]) => norm(k).includes('inicio') && norm(k).includes('afast'));
    const fim = Object.entries(r.data||{}).find(([k]) => norm(k).includes('fim') && norm(k).includes('afast'));
    const vIni = ini ? String(ini[1]||'') : '';
    const vFim = fim ? String(fim[1]||'') : '';
    if(!/^\d{4}-\d{2}-\d{2}/.test(vIni)) return false;
    if(!vFim) return true;
    const dFim = new Date(vFim);
    const hoje = new Date();
    return dFim > hoje; // afastamento ainda válido
  };
  const isDemitido = (r: Row)=>{
    const dem = Object.entries(r.data||{}).find(([k]) => norm(k).includes('demiss'));
    const v = dem ? String(dem[1]||'').trim() : '';
    return !!v && /^\d{4}-\d{2}-\d{2}/.test(v);
  };

  // Filtro de status: inclui derivados e tipos de ASO mais comuns
  const STATUS_OPTS = [
    'Admitido','Demitido','Afastado',
    'Admissional','Periódico','Demissional','Retorno ao Trabalho','Mudança de Função'
  ] as const;

  const rowMatchesStatus = (r: Row, status: string)=>{
    const s = status.toLowerCase();
    if(s === 'demitido') return isDemitido(r);
    if(s === 'admitido') return !isDemitido(r);
    if(s === 'afastado') return hasAfastamentoAtivo(r);
    const tipo = norm(getTipoAso(r));
    if(!tipo) return false;
    if(s.startsWith('admission')) return tipo.includes('admiss'); // safety
    if(s.includes('per')) return tipo.includes('period');
    if(s.includes('demiss')) return tipo.includes('demiss');
    if(s.includes('retorno')) return tipo.includes('retorno');
    if(s.includes('mudan')) return tipo.includes('mudan');
    // generic contains
    return tipo.includes(norm(status));
  };

  const rowsFiltered = useMemo(()=>{
    return rows.filter(r=>{
      if(fRegional && getRegionalOfRow(r) !== fRegional) return false;
      if(fUnidade){
        const uniVal = unidadeCol ? (r.data?.[unidadeCol] || '') : '';
        if(norm(uniVal) !== norm(fUnidade)) return false;
      }
      if(fStatus){
        if(!rowMatchesStatus(r, fStatus)) return false;
      }
      return true;
    });
  }, [rows, fRegional, fUnidade, fStatus, unidadeCol, regionalLookup]);

  // Opções
  const regionaisOpts = useMemo(()=>{
    const set = new Set(unidades.map(u=>u.regional).filter(Boolean));
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [unidades]);
  const unidadesOpts = useMemo(()=>{
    return unidades.map(u=>u.unidade).sort((a,b)=>a.localeCompare(b));
  }, [unidades]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Alterdata — Base Completa (último upload)</h1>
        <p className="text-muted">Visual com Regional (join por Unidade) e filtros de Status/Regional/Unidade. Nada altera a base ou o upload.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="input input-bordered w-80"
          placeholder="Buscar (nome, CPF, matrícula, unidade, função)"
          value={q}
          onChange={e=>{ setPage(1); setQ(e.target.value); }}
        />
        <select className="select select-bordered" value={limit} onChange={e=>{ setPage(1); setLimit(parseInt(e.target.value)); }}>
          {[25,50,100,150,200].map(n => <option key={n} value={n}>{n}/página</option>)}
        </select>
        <div className="text-muted">Total: {rowsFiltered.length} / {total}</div>

        <div className="divider divider-horizontal"></div>

        <select className="select select-bordered" value={fRegional} onChange={e=>setFRegional(e.target.value)}>
          <option value="">Regional (todas)</option>
          {regionaisOpts.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select select-bordered" value={fUnidade} onChange={e=>setFUnidade(e.target.value)}>
          <option value="">Unidade (todas)</option>
          {unidadesOpts.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className="select select-bordered" value={fStatus} onChange={e=>setFStatus(e.target.value)}>
          <option value="">Status (todos)</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-auto border border-border rounded-xl">
        <table className="min-w-max text-sm text-center">
          <thead className="bg-panel sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-center">#</th>
              {cols.map(c => (
                <th key={c} className="px-3 py-2 text-center whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-2" colSpan={cols.length+1}>Carregando...</td></tr>
            ) : rowsFiltered.length === 0 ? (
              <tr><td className="px-3 py-2" colSpan={cols.length+1}>Nenhum registro</td></tr>
            ) : rowsFiltered.map((r) => (
              <tr key={r.row_no} className="odd:bg-transparent even:bg-card">
                <td className="px-3 py-2 text-center">{r.row_no}</td>
                {cols.map(c => (
                  <td key={c} className="px-3 py-2 whitespace-nowrap text-center">
                    {c === 'Regional responsável'
                      ? getRegionalOfRow(r)
                      : formatCell(c, r.data?.[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</button>
        <div>Página {page}</div>
        <button className="btn" disabled={(page*limit)>=total} onClick={()=>setPage(p=>p+1)}>Próxima</button>
      </div>
    </div>
  );
}
