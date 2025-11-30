'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Role = 'admin' | 'regional' | 'unidade' | 'operador';

type UsuarioRow = {
  id: string;
  clerkUserId: string;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  regionalId: string | null;
  regionalNome: string | null;
  regionalSigla: string | null;
  unidadeId: string | null;
  unidadeNome: string | null;
  unidadeSigla: string | null;
};

type Regional = {
  id: string;
  nome: string;
  sigla: string;
};

type Unidade = {
  id: string;
  nome: string;
  sigla: string;
  regionalId: string;
};

type ListResponse =
  | {
      ok: true;
      users: UsuarioRow[];
      regionais: Regional[];
      unidades: Unidade[];
    }
  | { ok: false; error?: string };

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  regional: 'Gestor regional',
  unidade: 'Gestor de unidade',
  operador: 'Operador',
};

const fieldClass =
  'w-full px-3 py-2 rounded-xl border border-border bg-panel text-xs text-text placeholder:text-muted shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500';

export default function AdminUsersClient() {
  const [users, setUsers] = useState<UsuarioRow[]>([]);
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const r = await fetch('/api/admin/users/list');
        const json: ListResponse = await r.json();
        if (!r.ok || !('ok' in json) || !json.ok) {
          if (!cancelled)
            setError('Não foi possível carregar a lista de usuários.');
          return;
        }
        if (!cancelled) {
          setUsers(json.users || []);
          setRegionais(json.regionais || []);
          setUnidades(json.unidades || []);
        }
      } catch (e) {
        if (!cancelled)
          setError('Não foi possível carregar a lista de usuários.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const unitsByRegional = useMemo(() => {
    const map: Record<string, Unidade[]> = {};
    for (const u of unidades) {
      if (!map[u.regionalId]) map[u.regionalId] = [];
      map[u.regionalId].push(u);
    }
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.nome.localeCompare(b.nome)),
    );
    return map;
  }, [unidades]);

  function updateUser(id: string, patch: Partial<UsuarioRow>) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              ...patch,
            }
          : u,
      ),
    );
  }

  async function saveUser(row: UsuarioRow) {
    const payload = {
      id: row.id,
      role: row.role,
      ativo: row.ativo,
      regionalId: row.regionalId,
      unidadeId: row.unidadeId,
    };
    const newSet = new Set(savingIds);
    newSet.add(row.id);
    setSavingIds(newSet);
    try {
      const r = await fetch('/api/admin/users/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok) {
        alert(
          json?.error ||
            'Não foi possível salvar as permissões desse usuário.',
        );
      } else if (json.user) {
        // Atualiza com dados normalizados do servidor
        updateUser(row.id, json.user);
      }
    } catch (e) {
      alert('Erro inesperado ao salvar. Tente novamente.');
    } finally {
      const s2 = new Set(newSet);
      s2.delete(row.id);
      setSavingIds(s2);
    }
  }

  if (loading) {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Usuários &amp; permissões</h2>
        <p className="text-xs text-muted mb-3">
          Carregando lista de usuários cadastrados...
        </p>
        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm text-sm text-muted">
          Carregando...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Usuários &amp; permissões</h2>
        <p className="text-xs text-muted mb-3">
          Configuração detalhada do que cada usuário pode ver no sistema.
        </p>
        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm text-sm text-red-500">
          {error}
        </div>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Usuários &amp; permissões</h2>
        <p className="text-xs text-muted mb-3">
          Assim que novos usuários fizerem login com o Clerk, eles aparecerão aqui para que você
          consiga definir o papel (admin, regional, unidade, operador) e o escopo de acesso.
        </p>
        <div className="rounded-xl border border-border bg-panel p-4 shadow-sm text-sm text-muted">
          Nenhum usuário encontrado ainda. Peça para os gestores acessarem o sistema pelo menos
          uma vez para aparecerem aqui.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-2">Usuários &amp; permissões</h2>
      <p className="text-xs text-muted mb-3">
        Defina o papel de cada pessoa e qual Regional/Unidade ela pode visualizar. As permissões
        passam a valer em todas as telas após o salvamento.
      </p>
      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-2 py-1 text-left">Nome</th>
              <th className="px-2 py-1 text-left">E-mail</th>
              <th className="px-2 py-1 text-left">Papel</th>
              <th className="px-2 py-1 text-left">Regional</th>
              <th className="px-2 py-1 text-left">Unidade</th>
              <th className="px-2 py-1 text-center">Ativo</th>
              <th className="px-2 py-1 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSaving = savingIds.has(u.id);
              const allowedUnits =
                u.regionalId && unitsByRegional[u.regionalId]
                  ? unitsByRegional[u.regionalId]
                  : [];

              const disableRegional = u.role === 'admin';
              const disableUnidade = u.role === 'admin' || u.role === 'regional';

              return (
                <tr
                  key={u.id}
                  className="border-b border-border/60 last:border-0 align-top"
                >
                  <td className="px-2 py-1 whitespace-nowrap max-w-[180px]">
                    <div className="truncate" title={u.nome}>
                      {u.nome || '—'}
                    </div>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap max-w-[220px]">
                    <div className="truncate" title={u.email}>
                      {u.email}
                    </div>
                  </td>
                  <td className="px-2 py-1 min-w-[140px]">
                    <select
                      className={fieldClass}
                      value={u.role}
                      onChange={(e) =>
                        updateUser(u.id, {
                          role: e.target.value as Role,
                          // Limpa escopos incoerentes ao mudar papel
                          regionalId:
                            e.target.value === 'admin'
                              ? null
                              : u.regionalId,
                          unidadeId:
                            e.target.value === 'admin' ||
                            e.target.value === 'regional'
                              ? null
                              : u.unidadeId,
                        })
                      }
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 min-w-[160px]">
                    <select
                      className={fieldClass}
                      disabled={disableRegional}
                      value={u.regionalId || ''}
                      onChange={(e) => {
                        const newRegionalId = e.target.value || null;
                        updateUser(u.id, {
                          regionalId: newRegionalId,
                          // Ao trocar a regional, limpamos a unidade
                          unidadeId: null,
                        });
                      }}
                    >
                      <option value="">(nenhuma)</option>
                      {regionais.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.sigla} - {r.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 min-w-[180px]">
                    <select
                      className={fieldClass}
                      disabled={disableUnidade}
                      value={u.unidadeId || ''}
                      onChange={(e) =>
                        updateUser(u.id, {
                          unidadeId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">(nenhuma)</option>
                      {allowedUnits.map((un) => (
                        <option key={un.id} value={un.id}>
                          {un.sigla} - {un.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={u.ativo}
                      onChange={(e) =>
                        updateUser(u.id, { ativo: e.target.checked })
                      }
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => saveUser(u)}
                      disabled={isSaving}
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
