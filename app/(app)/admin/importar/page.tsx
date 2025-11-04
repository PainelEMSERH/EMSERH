
'use client';
import React, { useState } from 'react';

export default function ImportarAlterdataPage(){
  const [file, setFile] = useState<File|null>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent){
    e.preventDefault();
    if(!file) { setStatus('Escolha um arquivo .xlsx ou .csv'); return; }
    setBusy(true); setStatus('Enviando e processando...');
    try{
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/alterdata/import', { method: 'POST', body: fd });
      const j = await r.json();
      if(!r.ok || !j.ok){
        setStatus(`Erro: ${j.error || 'falha no upload'}`);
      }else{
        setStatus(`Importação concluída. Batch: ${j.batchId}. Linhas: ${j.total_rows}`);
      }
    }catch(e:any){
      setStatus(`Erro: ${e?.message||e}`);
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">Importar Alterdata</h1>
      <p className="text-muted mb-4">Envie o Excel (.xlsx) ou CSV. O sistema salva 100% das colunas no staging e atualiza o subset que o site usa.</p>
      <form onSubmit={onSubmit} className="space-y-3 bg-card border border-border rounded-xl p-4">
        <input type="file" accept=".xlsx,.csv" onChange={(e)=>setFile(e.target.files?.[0]||null)} className="block w-full" />
        <button disabled={busy || !file} className="btn btn-primary">{busy ? 'Processando...' : 'Importar'}</button>
      </form>
      {status && <div className="mt-3 text-sm">{status}</div>}
    </div>
  );
}
