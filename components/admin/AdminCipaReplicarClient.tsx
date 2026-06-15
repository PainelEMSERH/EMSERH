'use client';

import React, { useState } from 'react';
import { AlertTriangle, CopyPlus } from 'lucide-react';

export default function AdminCipaReplicarClient() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const replicar = async () => {
    if (
      !confirm(
        'Recalcular todo o cronograma CIPA 2026 a partir das posse de 2025?\n\n' +
          'Datas já editadas manualmente serão preservadas, mas use apenas se souber o que está fazendo.',
      )
    ) {
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cipa/replicar-2026', { method: 'POST', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Falha ao replicar');
      }
      setMsg({
        type: 'ok',
        text: `${data.inserted ?? 0} atividade(s) em ${data.units ?? 0} unidade(s). Conclusões e datas editadas foram preservadas.`,
      });
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao replicar 2026' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-text">CIPA — Replicar cronograma 2026</h2>
          <p className="text-xs text-muted mt-1">
            Recria todas as linhas de 2026 a partir da data de posse de 2025. As edições manuais já
            gravadas (início, fim e conclusão) são preservadas. Usuários da CIPA editam datas pelo
            botão <strong>Editar</strong> — não precisam desta ação.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={replicar}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-amber-600 bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <CopyPlus className="w-4 h-4" />
        )}
        Replicar 2026 (admin)
      </button>
      {msg && (
        <p className={`text-xs ${msg.type === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
