'use client';
import React, { useState } from 'react';

export default function ImportarAlterdataClient() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setStatus('Escolha um arquivo .xlsx ou .csv');
      return;
    }
    setBusy(true);
    setStatus('Enviando e processando...');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/alterdata/import', {
        method: 'POST',
        body: fd,
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setStatus(
          'Erro ao importar: ' +
            (j?.error || 'verifique o arquivo e tente novamente.'),
        );
      } else {
        setStatus(
          `Importação concluída. Lote ${j.batchId} com ${j.total_rows} linhas processadas.`,
        );
      }
    } catch (e: any) {
      setStatus('Erro inesperado ao enviar o arquivo. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-2">Importar Alterdata</h2>
      <p className="text-sm text-muted mb-4">
        Envie o Excel (.xlsx) ou CSV da base Alterdata oficial. Apenas o administrador raiz pode
        executar esta operação.
      </p>
      <form
        onSubmit={onSubmit}
        className="space-y-3 bg-card border border-border rounded-xl p-4"
      >
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
        <button
          disabled={busy || !file}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? 'Processando...' : 'Importar'}
        </button>
      </form>
      {status && <div className="mt-3 text-sm">{status}</div>}
    </div>
  );
}
