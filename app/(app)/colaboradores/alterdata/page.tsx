'use client';
import React, { useEffect, useMemo, useState } from 'react';

type Row = { row_no: number; data: Record<string,string> };
type ApiRows = { ok: boolean; rows: Row[]; page: number; limit: number; total: number; error?: string };
type ApiCols = { ok: boolean; columns: string[]; error?: string };

type UnidadeMap = { unidade: string; regional: string };

// === Display formatters (visual only; não alteram a base) ===
function stripAccents(s: string){ return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function norm(s: string){ return stripAccents(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function formatDateBR(value: string){
  if(!value) return '';
  // captura YYYY-MM-DD e HH:MM:SS (opcional)
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

  // datas comuns na Alterdata (renderização): Admissão, Nascimento, Demissão, Atestado, Início/Fim Afastamento, Próximo ASO etc.
  if (c.startsWith('data') || c.includes('admiss') || c.includes('demiss') || c.includes('nasc') || c.includes('atest') || c.includes('afast') || (c.includes('aso') && (c.includes('prox') || c.includes('proxim')))) {
    return formatDateBR(value);
  }

  if(c.includes('celular') || c.includes('telefone') || c.endsWith('fone')){
    return formatTelefoneBR(value);
  }

  return value;
}
// === /formatters ===

export default function AlterdataCompletaPage(){
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Unidades ↔ Regional (para "procv")
  const [unidades, setUnidades] = useState<UnidadeMap[]>([]);
  const regionalLookup = useMemo(()=>{
    const map = new Map<string,string>();
    for(const u of unidades){
      map.set(norm(u.unidade), u.regional);
    }
    return map;
  },[unidades]);

  // Filtros extras
  const [fRegional, setFRegional] = useState('');
  const [fUnidade, setFUnidade] = useState('');
  const [fTipoAso, setFTipoAso] = useState(''); // Admissional, Periódico, etc.
  const [fStatus, setFStatus] = useState(''); // Demitido, Admitido, etc.

  // Descobrir nome da coluna de unidade na Alterdata
  const unidadeCol = useMemo(()=>{
    const ncols = cols.map(c=>norm(c));
    const candid = [
      'unidade',
      'unidadehospitalar',
      'departamento',
      'nmddepartamento',
      'setor',
      'lotacao'
    ];
    for(const cand of candid){
      const idx = ncols.findIndex(n => n.includes(cand));
      if(idx >= 0) return cols[idx];
    }
    return cols.find(c=>norm(c).includes('unid')) || cols.find(c=>norm(c).includes('depart')) || '';
  },[cols]);

  // Carregar colunas da Alterdata
  useEffect(()=>{
    let on = true;
    (async ()=>{
      const r = await fetch('/api/alterdata/raw-columns');
      const j: ApiCols = await r.json();
      if(on && j.ok){
        // Oculta colunas apenas no visual (não altera a base/subida)
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
        // Adiciona coluna derivada de Regional, se detectarmos a de Unidade
        if(!filtered.includes('Regional responsável')){
          filtered.push('Regional responsável');
        }
        setCols(filtered);
      }
    })();
    return ()=>{ on=false; };
  }, []);

  // Carregar mapeamento Unidade→Regional (reuso do endpoint de Entregas)
  useEffect(()=>{
    let on = true;
    (async ()=>{
      try{
        const r = await fetch('/api/entregas/options');
        const j = await r.json();
        if(on){
          const list = Array.isArray(j?.unidades) ? j.unidades as UnidadeMap[] : [];
          setUnidades(list);
        }
      }catch{ /* ignore */ }
    })();
    return ()=>{ on=false; };
  }, []);

  // Carregar linhas
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

  // Helpers de filtro por linha
  const getRegionalOfRow = (r: Row)=>{
    const unidadeValor = unidadeCol ? (r.data?.[unidadeCol] || '') : '';
    return regionalLookup.get(norm(unidadeValor)) || '';
  };
  const getTipoAso = (r: Row)=>{
    const entry = Object.entries(r.data||{}).find(([k]) => norm(k).includes('tipodeaso') || norm(k) === 'tipodeaso' || norm(k).includes('aso'));
    return entry ? entry[1] : '';
  };
  const isDemitido = (r: Row)=>{
    // considera demitido se houver data de Demissão preenchida
    const dem = Object.entries(r.data||{}).find(([k]) => norm(k).includes('demiss'));
    const v = dem ? String(dem[1]||'').trim() : '';
    return !!v && /^\d{4}-\d{2}-\d{2}/.test(v);
  };
  const isAdmitido = (r: Row)=>{
    return !isDemitido(r);
  };

  const rowsFiltered = useMemo(()=>{
    return rows.filter(r=>{
      if(fRegional && getRegionalOfRow(r) !== fRegional) return false;
      if(fUnidade){
        const uniVal = unidadeCol ? (r.data?.[unidadeCol] || '') : '';
        if(norm(uniVal) !== norm(fUnidade)) return false;
      }
      if(fTipoAso){
        if(norm(getTipoAso(r)) !== norm(fTipoAso)) return false;
      }
      if(fStatus){
        if(fStatus === 'Demitido' && !isDemitido(r)) return false;
        if(fStatus === 'Admitido' && !isAdmitido(r)) return false;
      }
      return true;
    });
  }, [rows, fRegional, fUnidade, fTipoAso, fStatus, unidadeCol, regionalLookup]);

  // Opções das combos
  const regionaisOpts = useMemo(()=>{
    const set = new Set(unidades.map(u=>u.regional).filter(Boolean));
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [unidades]);
  const unidadesOpts = useMemo(()=>{
    const set = new Set<string>();
    for(const r of rows){
      const uv = unidadeCol ? (r.data?.[unidadeCol] || '') : '';
      if(uv) set.add(uv);
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [rows, unidadeCol]);
  const tipoAsoOpts = useMemo(()=>{
    const set = new Set<string>();
    for(const r of rows){
      const v = getTipoAso(r);
      if(v) set.add(v);
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [rows]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Alterdata — Base Completa (último upload)</h1>
        <p className="text-muted">Exibe exatamente as colunas da planilha importada. Busca por Nome / CPF / Matrícula / Unidade / Função. Agora com Regional e filtros.</p>
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
          <option value="Admitido">Admitido</option>
          <option value="Demitido">Demitido</option>
        </select>
        <select className="select select-bordered" value={fTipoAso} onChange={e=>setFTipoAso(e.target.value)}>
          <option value="">Tipo de ASO (todos)</option>
          {tipoAsoOpts.map(t => <option key={t} value={t}>{t}</option>)}
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
