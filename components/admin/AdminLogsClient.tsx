'use client';
import React, { useEffect, useState } from 'react';

type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string | null;
  diff?: any;
  createdAt: string;
};

type ApiResponse =
  | { ok: true; logs: AuditLog[] }
  | { ok: false; error?: string };

export default function AdminLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const r = await fetch('/api/admin/logs');
        const json: ApiResponse = await r.json();
        if (!r.ok || !('ok' in json) || !json.ok) {
          if (!cancelled) setError('Não foi possível carregar o log de ações.');
          return;
        }
        if (!cancelled) {
          setLogs(json.logs || []);
        }
      } catch (e) {
        if (!cancelled) setError('Não foi possível carregar o log de ações.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-2">Últimas ações</h2>
      <p className="text-xs text-muted mb-3">
        Registro das operações administrativas mais recentes (importações, alterações críticas, etc.).
      </p>
      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm overflow-x-auto">
        {loading && <p className="text-sm text-muted">Carregando log...</p>}
        {!loading && error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        {!loading && !error && logs.length === 0 && (
          <p className="text-sm text-muted">Nenhuma ação registrada ainda.</p>
        )}
        {!loading && !error && logs.length > 0 && (
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                <th className="px-2 py-1 text-left">Data / Hora</th>
                <th className="px-2 py-1 text-left">Usuário</th>
                <th className="px-2 py-1 text-left">Ação</th>
                <th className="px-2 py-1 text-left">Entidade</th>
                <th className="px-2 py-1 text-left">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const dt = new Date(log.createdAt);
                const when = Number.isNaN(dt.getTime())
                  ? log.createdAt
                  : dt.toLocaleString('pt-BR');
                let detail = log.entityId || '';
                if (!detail && log.diff) {
                  try {
                    const d = log.diff as any;
                    if (d && typeof d === 'object') {
                      if (d.source || d.totalRows) {
                        detail = [
                          d.source ? `Fonte: ${d.source}` : '',
                          typeof d.totalRows === 'number'
                            ? `Linhas: ${d.totalRows}`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' • ');
                      }
                    }
                  } catch {
                    // ignore
                  }
                }
                return (
                  <tr
                    key={log.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {when}
                    </td>
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {log.actorId || '—'}
                    </td>
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {log.entity}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {detail || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
