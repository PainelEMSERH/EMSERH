'use client';
import React, { useEffect, useMemo, useState } from 'react';

type Row = { row_no: number; data: Record<string,string> };
type ApiRows = { ok: boolean; rows: Row[]; page: number; limit: number; total: number; error?: string };
type ApiCols = { ok: boolean; columns: string[]; error?: string };

type UnidadeMap = { unidade: string; regional: string };

// === Fallback (usado se o endpoint não responder) ===
const FALLBACK_UNIDADES: UnidadeMap[] = [
  { unidade: "AGENCIA TRANSFUSIONAL BARRA DO CORDA", regional: "CENTRO" },
  { unidade: "AGENCIA TRANSFUSIONAL CHAPADINHA", regional: "LESTE" },
  { unidade: "AGENCIA TRANSFUSIONAL COLINAS", regional: "CENTRO" },
  { unidade: "AGENCIA TRANSFUSIONAL DE SÃO JOÃO DOS PATOS", regional: "CENTRO" },
  { unidade: "AGENCIA TRANSFUSIONAL DE VIANA", regional: "NORTE" },
  { unidade: "AGENCIA TRANSFUSIONAL TIMON", regional: "LESTE" },
  { unidade: "CAF - FEME", regional: "NORTE" },
  { unidade: "CAF - SEDE EMSERH", regional: "NORTE" },
  { unidade: "CASA DA GESTANTE, BEBE E PUERPERA", regional: "SUL" },
  { unidade: "CASA TEA 12+", regional: "NORTE" },
  { unidade: "CENTRAL DE REGULACAO - AMBULATORIAL", regional: "NORTE" },
  { unidade: "CENTRAL DE REGULACAO - LEITOS", regional: "NORTE" },
  { unidade: "CENTRAL DE REGULACAO - TRANSPORTE", regional: "NORTE" },
  { unidade: "CENTRO DA PESSOA IDOSA", regional: "SUL" },
  { unidade: "CENTRO DE SAUDE GENESIO REGO", regional: "NORTE" },
  { unidade: "CENTRO DE TERAPIA RENAL SUBSTITUTIVA", regional: "NORTE" },
  { unidade: "CENTRO ESPECIALIDADES MEDICAS PAM DIAMANTE", regional: "NORTE" },
  { unidade: "CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA", regional: "NORTE" },
  { unidade: "CENTRO ESPECIALIZADO DE REABILITACAO OLHO D AGUA", regional: "NORTE" },
  { unidade: "EMSERH SEDE", regional: "NORTE" },
  { unidade: "EMSERH SEDE DIRETORIA", regional: "NORTE" },
  { unidade: "FEME", regional: "NORTE" },
  { unidade: "FEME - UGAF", regional: "NORTE" },
  { unidade: "FEME DE CAXIAS", regional: "LESTE" },
  { unidade: "FEME IMPERATRIZ", regional: "SUL" },
  { unidade: "FESMA", regional: "NORTE" },
  { unidade: "HEMOMAR", regional: "NORTE" },
  { unidade: "HEMONUCLEO DE BACABAL", regional: "CENTRO" },
  { unidade: "HEMONUCLEO DE BALSAS", regional: "SUL" },
  { unidade: "HEMONUCLEO DE CAXIAS", regional: "LESTE" },
  { unidade: "HEMONUCLEO DE CODO", regional: "LESTE" },
  { unidade: "HEMONUCLEO DE IMPERATRIZ", regional: "SUL" },
  { unidade: "HEMONUCLEO DE PEDREIRAS", regional: "CENTRO" },
  { unidade: "HEMONUCLEO PINHEIRO", regional: "NORTE" },
  { unidade: "HEMONUCLEO SANTA INES", regional: "SUL" },
  { unidade: "HOSPITAL ADELIA MATOS FONSECA", regional: "LESTE" },
  { unidade: "HOSPITAL AQUILES LISBOA", regional: "NORTE" },
  { unidade: "HOSPITAL DA ILHA", regional: "NORTE" },
  { unidade: "HOSPITAL DE BARREIRINHAS", regional: "NORTE" },
  { unidade: "HOSPITAL DE CUIDADOS INTENSIVOS - HCI", regional: "NORTE" },
  { unidade: "HOSPITAL DE PAULINO NEVES", regional: "NORTE" },
  { unidade: "HOSPITAL DE PEDREIRAS", regional: "CENTRO" },
  { unidade: "HOSPITAL E MATERNIDADE ADERSON MARINHO - P. FRANCO", regional: "SUL" },
  { unidade: "HOSPITAL GENESIO REGO", regional: "NORTE" },
  { unidade: "HOSPITAL GERAL DE ALTO ALEGRE", regional: "LESTE" },
  { unidade: "HOSPITAL GERAL DE GRAJAU", regional: "CENTRO" },
  { unidade: "HOSPITAL GERAL DE PERITORO", regional: "LESTE" },
  { unidade: "HOSPITAL MACROREGIONAL DE CAXIAS", regional: "LESTE" },
  { unidade: "HOSPITAL MACROREGIONAL DE COROATA", regional: "LESTE" },
  { unidade: "HOSPITAL MACRORREGIONAL DRA RUTH NOLETO", regional: "SUL" },
  { unidade: "HOSPITAL MATERNO INFANTIL IMPERATRIZ", regional: "SUL" },
  { unidade: "HOSPITAL PRESIDENTE DUTRA", regional: "CENTRO" },
  { unidade: "HOSPITAL PRESIDENTE VARGAS", regional: "NORTE" },
  { unidade: "HOSPITAL REGIONAL ALARICO NUNES PACHECO - Timon", regional: "LESTE" },
  { unidade: "HOSPITAL REGIONAL DE BARRA DO CORDA", regional: "CENTRO" },
  { unidade: "HOSPITAL REGIONAL DE CARUTAPERA", regional: "NORTE" },
  { unidade: "HOSPITAL REGIONAL DE CHAPADINHA", regional: "LESTE" },
  { unidade: "HOSPITAL REGIONAL DE LAGO DA PEDRA", regional: "CENTRO" },
  { unidade: "HOSPITAL REGIONAL DE MORROS", regional: "NORTE" },
  { unidade: "HOSPITAL REGIONAL DE TIMBIRAS", regional: "LESTE" },
  { unidade: "HOSPITAL REGIONAL SANTA LUZIA DO PARUA", regional: "NORTE" },
  { unidade: "HOSPITAL VILA LUIZAO", regional: "NORTE" },
  { unidade: "LACEN", regional: "NORTE" },
  { unidade: "LACEN IMPERATRIZ", regional: "SUL" },
  { unidade: "POLICLINICA AÇAILANDIA", regional: "SUL" },
  { unidade: "POLICLINICA BARRA DO CORDA", regional: "CENTRO" },
  { unidade: "POLICLINICA CAXIAS", regional: "LESTE" },
  { unidade: "POLICLINICA CIDADE OPERARIA", regional: "NORTE" },
  { unidade: "POLICLINICA COHATRAC", regional: "NORTE" },
  { unidade: "POLICLINICA DE CODÓ", regional: "LESTE" },
  { unidade: "POLICLINICA DE IMPERATRIZ", regional: "SUL" },
  { unidade: "POLICLINICA DE MATOES DO NORTE", regional: "LESTE" },
  { unidade: "POLICLINICA DO COROADINHO", regional: "NORTE" },
  { unidade: "POLICLINICA DO CUJUPE", regional: "NORTE" },
  { unidade: "POLICLINICA VILA LUIZAO", regional: "NORTE" },
  { unidade: "POLICLINICA VINHAIS", regional: "NORTE" },
  { unidade: "PROGRAMA DE ACAO INTEGRADA PARA APOSENTADOS - PAI", regional: "NORTE" },
  { unidade: "RESIDENCIA MEDICA E MULTI - ANALISTAS TECNICOS", regional: "NORTE" },
  { unidade: "SHOPPING DA CRIANÇA", regional: "NORTE" },
  { unidade: "SOLAR DO OUTONO", regional: "NORTE" },
  { unidade: "SVO -SERV. VERIFICAÇÃO DE ÓBITOS - SÃO LUÍS", regional: "NORTE" },
  { unidade: "SVO -SERV. VERIFICAÇÃO DE ÓBITOS - TIMON", regional: "LESTE" },
  { unidade: "SVO -SERV.VERIFICAÇÃO DE ÓBITOS - IMPERATRIZ", regional: "SUL" },
  { unidade: "TEA - CENTRO ESPECIALIZADO DE REAB. OLHO D AGUA", regional: "NORTE" },
  { unidade: "UPA ARACAGY", regional: "NORTE" },
  { unidade: "UPA CIDADE OPERARIA", regional: "NORTE" },
  { unidade: "UPA CODO", regional: "LESTE" },
  { unidade: "UPA COROATA", regional: "LESTE" },
  { unidade: "UPA DE IMPERATRIZ", regional: "SUL" },
  { unidade: "UPA ITAQUI BACANGA", regional: "NORTE" },
  { unidade: "UPA PAÇO DO LUMIAR", regional: "NORTE" },
  { unidade: "UPA PARQUE VITORIA", regional: "NORTE" },
  { unidade: "UPA SAO JOAO DOS PATOS", regional: "CENTRO" },
  { unidade: "UPA TIMON", regional: "LESTE" },
  { unidade: "UPA VINHAIS", regional: "NORTE" }
];

// === Helpers (somente visual) ===
function stripAccents(s: string){ return (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function norm(s: string){ return stripAccents((s || '').trim()).toLowerCase().replace(/[^a-z0-9]/g, ''); }

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

  // Unidades ↔ Regional
  const [unidades, setUnidades] = useState<UnidadeMap[]>(FALLBACK_UNIDADES);
  const unitKeySet = useMemo(()=> new Set(unidades.map(u => norm(u.unidade))), [unidades]);
  const regionalLookup = useMemo(()=>{
    const map = new Map<string,string>();
    for(const u of unidades) map.set(norm(u.unidade), u.regional);
    return map;
  },[unidades]);

  // Filtros
  const [fRegional, setFRegional] = useState('');
  const [fUnidade, setFUnidade] = useState('');
  const [fStatus, setFStatus] = useState(''); // Demitido, Admitido, Afastado

  // Carregar colunas
  useEffect(()=>{
    let on = true;
    (async ()=>{
      const r = await fetch('/api/alterdata/raw-columns');
      const j: ApiCols = await r.json();
      if(on && j.ok){
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
        if(!filtered.includes('Regional responsável')) filtered.push('Regional responsável');
        setCols(filtered);
      }
    })();
    return ()=>{ on=false; };
  }, []);

  // Tenta carregar mapping via API; se falhar, mantém fallback
  useEffect(()=>{
    let on = true;
    (async ()=>{
      try{
        const r = await fetch('/api/colaboradores/unidades');
        const j = await r.json();
        if(on && Array.isArray(j?.unidades) && j.unidades.length) setUnidades(j.unidades as UnidadeMap[]);
      }catch{ /* fica no fallback */ }
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
      if(fRegional) params.set('regional', fRegional);
      if(fUnidade) params.set('unidade', fUnidade);
      if(fStatus) params.set('status', fStatus);
      if(fRegional) params.set('regional', fRegional);
      if(fUnidade) params.set('unidade', fUnidade);
      if(fStatus) params.set('status', fStatus);
      const r = await fetch(`/api/alterdata/raw-rows?${params.toString()}`);
      const j: ApiRows = await r.json();
      if(on){
        if(j.ok){ setRows(j.rows); setTotal(j.total); }
        else{ console.error(j.error); }
        setLoading(false);
      }
    })();
    return ()=>{ on=false; };
  }, [page, limit, q]);

  // Heurística: tenta localizar a coluna de Unidade; se não conseguir, usa scanner por linha
  const unidadeCol = useMemo(()=>{
    if(cols.length === 0 || rows.length === 0) return '';
    let bestCol = '';
    let bestScore = -1;
    const sample = rows.slice(0, 200);
    for(const c of cols){
      let score = 0;
      for(const r of sample){
        const v = norm(String(r.data?.[c] || ''));
        if(unitKeySet.has(v)) score++;
      }
      const n = norm(c);
      if(n.includes('unid')||n.includes('depart')||n.includes('lotac')||n.includes('setor')) score += 3;
      if(score > bestScore){ bestScore = score; bestCol = c; }
    }
    if(bestScore >= 2) return bestCol;
    for(const c of cols){
      const n = norm(c);
      if(n.includes('unidadehospitalar')||n.includes('unidade')||n.includes('departamento')||n.includes('nmddepartamento')||n.includes('lotacao')||n.includes('setor')) return c;
    }
    return '';
  }, [cols, rows, unitKeySet]);

  // Scanner robusto: procura dentro da linha algum campo que seja uma Unidade válida
  function findUnitValue(r: Row): string{
    if(unidadeCol){
      const uv = String(r.data?.[unidadeCol] ?? '');
      if(unitKeySet.has(norm(uv))) return uv;
    }
    // Varre todos os campos e pega o primeiro que bater no dicionário
    for(const [_, v] of Object.entries(r.data || {})){
      const nv = norm(String(v||''));
      if(unitKeySet.has(nv)) return String(v);
    }
    return '';
  }

  // Derivações por linha
  const getRegionalOfRow = (r: Row)=>{
    const uv = findUnitValue(r);
    return uv ? (regionalLookup.get(norm(uv)) || '') : '';
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
    return dFim > hoje;
  };
  const isDemitido = (r: Row)=>{
    const sit = Object.entries(r.data||{}).find(([k]) => norm(k).includes('situac') || norm(k).includes('status'));
    if(sit){ const v = norm(String(sit[1]||'')); if(v.includes('demit')) return true; }
    const dem = Object.entries(r.data||{}).find(([k]) => norm(k).includes('demiss'));
    const v = dem ? String(dem[1]||'').trim() : '';
    return !!v && /^\d{4}-\d{2}-\d{2}/.test(v);
  };

  const rowsFiltered = useMemo(()=>{
    return rows.filter(r=>{
      if(fRegional){
        const reg = getRegionalOfRow(r);
        if(reg !== fRegional) return false;
      }
      if(fUnidade){
        const uv = findUnitValue(r);
        if(norm(uv) !== norm(fUnidade)) return false;
      }
      if(fStatus === 'Demitido') return isDemitido(r);
      if(fStatus === 'Admitido') return !isDemitido(r);
      if(fStatus === 'Afastado') return hasAfastamentoAtivo(r);
      return true;
    });
  }, [rows, fRegional, fUnidade, fStatus, unidadeCol, regionalLookup]);

  // Opções para filtros (sempre completas)
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
          {['Admitido','Demitido','Afastado'].map(s => <option key={s} value={s}>{s}</option>)}
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
