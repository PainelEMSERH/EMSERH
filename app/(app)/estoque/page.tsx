// file: app/(app)/estoque/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { REGIONALS, canonUnidade } from '@/lib/unidReg';

type Regional = (typeof REGIONALS)[number];

type EstoqueOptions = {
  regionais: string[];
  unidades: { unidade: string; regional: string }[];
};

type ItemOption = { id: string; nome: string };

type MovRow = {
  id: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  destino: string | null;
  observacao: string | null;
  data: string;
  unidadeId: string;
  unidade: string;
  regionalId: string;
  regional: string;
  itemId: string;
  item: string;
};

type CatalogItem = {
  codigo_pa: string | null;
  descricao_cahosp: string | null;
  descricao_site: string | null;
  categoria_site: string | null;
  grupo_cahosp: string | null;
  unidade_site: string | null;
  tamanho_site: string | null;
  tamanho: string | null;
};

const fetchJSON = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const data = await r.json();
  if (!r.ok) {
    throw new Error((data && (data.error || data.message)) || 'Erro ao carregar dados');
  }
  return data as T;
};

const LS_REGIONAL_KEY = 'estoque_sesmt:regional';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

export default function EstoqueSESMTPage() {
  const [tab, setTab] = useState<'geral' | 'mov' | 'ped'>('mov');

  // Regional selecionada
  const [regional, setRegional] = useState<string>('');

  // Opções de regionais/unidades vindas do backend
  const [opts, setOpts] = useState<EstoqueOptions>({ regionais: [], unidades: [] });
  const [optsLoading, setOptsLoading] = useState(false);

  // Itens de estoque (select principal)
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Formulário de nova movimentação
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [itemId, setItemId] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('');
  const [dataMov, setDataMov] = useState<string>('');
  const [destinoUnidade, setDestinoUnidade] = useState<string>('');
  const [numeroPedido, setNumeroPedido] = useState<string>('');
  const [responsavel, setResponsavel] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Movimentações (lista inferior)
  const [movRows, setMovRows] = useState<MovRow[]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movPage, setMovPage] = useState(1);
  const movSize = 25;
  const [movLoading, setMovLoading] = useState(false);

  // Catálogo SESMT (modal)
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [novoEpiAberto, setNovoEpiAberto] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novoDescricao, setNovoDescricao] = useState('');
  const [novoCategoria, setNovoCategoria] = useState('');
  const [novoGrupo, setNovoGrupo] = useState('');
  const [novoUnidade, setNovoUnidade] = useState('');
  const [novoTamanho, setNovoTamanho] = useState('');
  const [novoSalvando, setNovoSalvando] = useState(false);

  // Carrega regional do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LS_REGIONAL_KEY);
    if (stored && REGIONALS.includes(stored as Regional)) {
      setRegional(stored);
    }
  }, []);

  // Salva regional no localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (regional) {
      window.localStorage.setItem(LS_REGIONAL_KEY, regional);
    }
  }, [regional]);

  // Carrega opções de estoque (regionais/unidades)
  useEffect(() => {
    setOptsLoading(true);
    fetchJSON<EstoqueOptions>('/api/estoque/options')
      .then((d) => setOpts(d))
      .catch(() => setOpts({ regionais: [], unidades: [] }))
      .finally(() => setOptsLoading(false));
  }, []);

  // Carrega itens para o select principal
  useEffect(() => {
    setItemsLoading(true);
    fetchJSON<{ items: ItemOption[] }>('/api/estoque/items')
      .then((d) => setItemOptions(d.items || []))
      .catch(() => setItemOptions([]))
      .finally(() => setItemsLoading(false));
  }, []);

  const unidadesDaRegional = useMemo(() => {
    if (!regional) return [] as { unidade: string; regional: string }[];
    return (opts.unidades || []).filter((u) => {
      if (!u.regional) return true;
      return u.regional.toUpperCase() === regional.toUpperCase();
    });
  }, [opts.unidades, regional]);

  const unidadeSESMTNome = useMemo(() => {
    if (!regional) return '';
    const unidadesFiltradas = unidadesDaRegional;
    const candidatos = unidadesFiltradas.filter((u) => {
      const nome = u.unidade.toUpperCase();
      return nome.includes('SESMT') || nome.includes('ESTOQUE SESMT');
    });
    if (candidatos.length > 0) return candidatos[0].unidade;
    return `ESTOQUE SESMT - ${regional}`;
  }, [unidadesDaRegional, regional]);

  const unidadesDestino = useMemo(() => {
    return unidadesDaRegional.filter((u) => {
      const nome = u.unidade.toUpperCase();
      return !(nome.includes('SESMT') || nome.includes('ESTOQUE SESMT'));
    });
  }, [unidadesDaRegional]);

  // Lista de movimentações para o estoque SESMT da regional selecionada
  useEffect(() => {
    if (!regional || !unidadeSESMTNome) {
      setMovRows([]);
      setMovTotal(0);
      return;
    }
    setMovLoading(true);
    const url = `/api/estoque/mov?regionalId=${encodeURIComponent(
      regional,
    )}&unidadeId=${encodeURIComponent(unidadeSESMTNome)}&page=${movPage}&size=${movSize}`;
    fetchJSON<{ rows: MovRow[]; total: number }>(url)
      .then((d) => {
        setMovRows(d.rows || []);
        setMovTotal(d.total || 0);
      })
      .catch(() => {
        setMovRows([]);
        setMovTotal(0);
      })
      .finally(() => setMovLoading(false));
  }, [regional, unidadeSESMTNome, movPage]);

  // Busca no catálogo SESMT (apenas consulta)
  useEffect(() => {
    if (!catalogOpen) return;
    if (!catalogQuery.trim()) {
      setCatalogItems([]);
      return;
    }
    let active = true;
    setCatalogLoading(true);
    const url = `/api/estoque/catalogo?q=${encodeURIComponent(catalogQuery.trim())}`;
    fetchJSON<{ items: CatalogItem[] }>(url)
      .then((d) => {
        if (!active) return;
        setCatalogItems(d.items || []);
      })
      .catch(() => {
        if (!active) return;
        setCatalogItems([]);
      })
      .finally(() => {
        if (!active) return;
        setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [catalogOpen, catalogQuery]);

  const canSave = useMemo(() => {
    if (!regional || !unidadeSESMTNome) return false;
    if (!itemId || !quantidade) return false;
    const qtd = Number(quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) return false;
    if (tipo === 'saida' && !destinoUnidade) return false;
    return true;
  }, [regional, unidadeSESMTNome, itemId, quantidade, tipo, destinoUnidade]);

async function handleSalvarNovoEpi() {
  if (novoSalvando) return;
  const desc = (novoDescricao || '').trim();
  if (!desc) {
    alert('Informe ao menos a descrição do EPI.');
    return;
  }
  try {
    setNovoSalvando(true);
    const body = {
      codigo_pa: novoCodigo || null,
      descricao_site: desc,
      categoria_site: (novoCategoria || 'EPI').trim() || 'EPI',
      grupo_cahosp: (novoGrupo || '').trim() || null,
      unidade_site: (novoUnidade || 'UN').trim() || 'UN',
      tamanho_site: (novoTamanho || '').trim() || null,
    };
    await fetchJSON('/api/estoque/catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Atualiza listas locais (catálogo e select de itens)
    const novoItemCatalogo: CatalogItem = {
      codigo_pa: body.codigo_pa,
      descricao_cahosp: null,
      descricao_site: body.descricao_site,
      categoria_site: body.categoria_site,
      grupo_cahosp: body.grupo_cahosp,
      unidade_site: body.unidade_site,
      tamanho_site: body.tamanho_site,
      tamanho: body.tamanho_site,
    };
    setCatalogItems((prev) => [novoItemCatalogo, ...prev]);
    const optId = body.descricao_site;
    setItemOptions((prev) => {
      const exists = prev.some((o) => o.id === optId);
      if (exists) return prev;
      return [{ id: optId, nome: body.descricao_site }, ...prev];
    });
    setItemId(optId);

    // Limpa formulário
    setNovoCodigo('');
    setNovoDescricao('');
    setNovoCategoria('');
    setNovoGrupo('');
    setNovoUnidade('');
    setNovoTamanho('');
    setNovoEpiAberto(false);
  } catch (e) {
    console.error(e);
    alert('Erro ao cadastrar novo EPI.');
  } finally {
    setNovoSalvando(false);
  }
}

  async function handleSalvarMovimentacao() {
    if (!canSave) return;
    try {
      setSaving(true);

      const qtd = Number(quantidade || 0);
      const unidadeNome = unidadeSESMTNome;
      const destino =
        tipo === 'entrada'
          ? 'Entrada no estoque do SESMT (CAHOSP → SESMT)'
          : destinoUnidade || null;

      const partesObs: string[] = [];
      if (tipo === 'entrada') {
        if (numeroPedido) partesObs.push(`Pedido CAHOSP: ${numeroPedido}`);
        if (responsavel) partesObs.push(`Recebido por: ${responsavel}`);
      } else {
        if (responsavel) partesObs.push(`Entregue por: ${responsavel}`);
      }
      if (observacao) partesObs.push(observacao);
      const obsFinal = partesObs.join(' | ') || null;

      const body = {
        unidadeId: unidadeNome,
        itemId,
        tipo,
        quantidade: qtd,
        destino,
        observacao: obsFinal,
        data: dataMov || null,
      };

      await fetchJSON('/api/estoque/mov', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Limpa campos específicos
      setQuantidade('');
      setDestinoUnidade('');
      setNumeroPedido('');
      setResponsavel('');
      setObservacao('');
      setDataMov('');

      // Recarrega lista
      const url = `/api/estoque/mov?regionalId=${encodeURIComponent(
        regional,
      )}&unidadeId=${encodeURIComponent(unidadeNome)}&page=${movPage}&size=${movSize}`;
      const d = await fetchJSON<{ rows: MovRow[]; total: number }>(url);
      setMovRows(d.rows || []);
      setMovTotal(d.total || 0);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar movimentação.');
    } finally {
      setSaving(false);
    }
  }

  const movTotalPages = useMemo(() => {
    return movTotal > 0 ? Math.ceil(movTotal / movSize) : 1;
  }, [movTotal]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Estoque SESMT</h1>
          <p className="text-xs text-muted">
            Controle de estoque por Regional do SESMT. Selecione a Regional e registre as movimentações.
          </p>
        </div>
      </div>

      {/* Seleção de Aba */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4 text-xs">
          <button
            type="button"
            onClick={() => setTab('geral')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'geral'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Visão geral
          </button>
          <button
            type="button"
            onClick={() => setTab('mov')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'mov'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Movimentações
          </button>
          <button
            type="button"
            onClick={() => setTab('ped')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'ped'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Pedidos
          </button>
        </nav>
      </div>

      {tab === 'geral' && (
        <div className="rounded-xl border border-border bg-panel p-4 text-xs text-muted">
          Visão geral do estoque SESMT ainda não implementada.
        </div>
      )}

      {tab === 'ped' && (
        <div className="rounded-xl border border-border bg-panel p-4 text-xs text-muted">
          Aba de pedidos ainda não implementada.
        </div>
      )}

      {tab === 'mov' && (
        <div className="space-y-4">
          {/* Filtro de Regional */}
          <div className="rounded-xl border border-border bg-panel p-4 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex flex-col gap-1">
              <span className="font-medium">Regional</span>
              <select
                className="w-52 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={regional}
                onChange={(e) => {
                  setRegional(e.target.value || '');
                  setMovPage(1);
                }}
              >
                <option value="">Selecione a Regional...</option>
                {REGIONALS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {optsLoading && <span className="text-[11px] text-muted">Carregando unidades...</span>}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Unidade (Estoque SESMT)</span>
              <input
                readOnly
                value={regional ? unidadeSESMTNome || '' : ''}
                placeholder="Selecione a Regional para ver o estoque do SESMT"
                className="w-80 rounded border border-border bg-card px-3 py-2 text-xs text-muted"
              />
            </div>
          </div>

          {/* Nova Movimentação */}
          <div className="rounded-xl border border-border bg-panel p-4 text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-sm">Nova movimentação</h2>
                <p className="text-[11px] text-muted">
                  Registre entradas e saídas do estoque SESMT da Regional selecionada.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-1.5 text-[11px] hover:bg-card"
                onClick={() => setCatalogOpen(true)}
              >
                Catálogo SESMT
              </button>
            </div>

            <div className="flex flex-wrap gap-4 border-b border-border pb-3">
              {/* Tipo */}
              <div className="flex flex-col gap-1">
                <span className="font-medium">Tipo</span>
                <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-[11px]">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-md ${
                      tipo === 'entrada' ? 'bg-emerald-600 text-white' : 'text-text'
                    }`}
                    onClick={() => setTipo('entrada')}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-md ${
                      tipo === 'saida' ? 'bg-emerald-600 text-white' : 'text-text'
                    }`}
                    onClick={() => setTipo('saida')}
                  >
                    Saída
                  </button>
                </div>
              </div>

              {/* Unidade (somente leitura) */}
              <div className="flex flex-col gap-1">
                <span className="font-medium">Unidade</span>
                <input
                  readOnly
                  value={regional ? unidadeSESMTNome || '' : ''}
                  placeholder="ESTOQUE SESMT – [Regional]"
                  className="w-64 rounded border border-border bg-card px-3 py-2 text-xs text-muted"
                />
              </div>

              {/* Item */}
              <div className="flex flex-col gap-1">
                <span className="font-medium">Item</span>
                <select
                  className="w-64 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  disabled={itemsLoading}
                >
                  <option value="">{itemsLoading ? 'Carregando itens...' : 'Selecione o item...'}</option>
                  {itemOptions.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantidade */}
              <div className="flex flex-col gap-1">
                <span className="font-medium">Quantidade</span>
                <input
                  type="number"
                  min={1}
                  className="w-28 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </div>
            </div>

            {/* Linha 2: destino/justificativa + data + nº pedido + responsável */}
            <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-4">
              <div className="flex flex-col gap-1 md:col-span-2">
                <span className="font-medium">{tipo === 'entrada' ? 'Destino / Justificativa' : 'Unidade hospitalar destino'}</span>
                {tipo === 'entrada' ? (
                  <input
                    readOnly
                    value="Entrada no estoque do SESMT (CAHOSP → SESMT)"
                    className="rounded border border-border bg-card px-3 py-2 text-xs text-muted"
                  />
                ) : (
                  <select
                    className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={destinoUnidade}
                    onChange={(e) => setDestinoUnidade(e.target.value)}
                  >
                    <option value="">Selecione a Unidade destino...</option>
                    {unidadesDestino.map((u) => (
                      <option key={u.unidade} value={u.unidade}>
                        {u.unidade}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-medium">
                  {tipo === 'entrada' ? 'Data de recebimento' : 'Data da entrega'}
                </span>
                <input
                  type="date"
                  className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  value={dataMov}
                  onChange={(e) => setDataMov(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-medium">
                  {tipo === 'entrada' ? 'Nº do pedido (CAHOSP)' : 'Nº do pedido'}
                </span>
                <input
                  className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-muted/40"
                  placeholder={tipo === 'entrada' ? 'Informe o número do pedido' : 'Não aplicável para saída'}
                  value={numeroPedido}
                  onChange={(e) => setNumeroPedido(e.target.value)}
                  disabled={tipo === 'saida'}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-medium">Responsável</span>
                <input
                  className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder={tipo === 'entrada' ? 'Responsável pelo recebimento' : 'Responsável pela entrega'}
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                />
              </div>
            </div>

            {/* Observação + salvar */}
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <span className="font-medium">Observação</span>
                <input
                  className="w-full rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Comentário breve (opcional)"
                  maxLength={120}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
                <span className="text-[10px] text-muted">
                  Máx. 120 caracteres. Use para detalhes rápidos sobre a movimentação.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSalvarMovimentacao}
                disabled={!canSave || saving}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  !canSave || saving
                    ? 'cursor-not-allowed bg-emerald-900/40 text-muted'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {saving ? 'Salvando...' : 'Salvar movimentação'}
              </button>
            </div>
          </div>

          {/* Lista de movimentações */}
          <div className="rounded-xl border border-border bg-panel p-4 text-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Movimentações do estoque SESMT</h2>
                <p className="text-[11px] text-muted">
                  Listagem das entradas e saídas registradas para o estoque SESMT da Regional selecionada.
                </p>
              </div>
              <div className="text-[11px] text-muted">
                Total: <span className="font-semibold">{movTotal}</span> movimentações
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="min-w-full text-[11px]">
                <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Unidade</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-left">Destino</th>
                    <th className="px-3 py-2 text-left">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {movLoading && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted">
                        Carregando movimentações...
                      </td>
                    </tr>
                  )}
                  {!movLoading && movRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted">
                        Nenhuma movimentação registrada para este estoque.
                      </td>
                    </tr>
                  )}
                  {!movLoading &&
                    movRows.map((m) => (
                      <tr key={m.id} className="border-t border-border/60">
                        <td className="px-3 py-2 align-top">{formatDate(m.data)}</td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={
                              m.tipo === 'entrada'
                                ? 'rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-300'
                                : 'rounded-full bg-red-900/30 px-2 py-0.5 text-[10px] text-red-200'
                            }
                          >
                            {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">{m.unidade}</td>
                        <td className="px-3 py-2 align-top">{m.item}</td>
                        <td className="px-3 py-2 text-right align-top">{m.quantidade}</td>
                        <td className="px-3 py-2 align-top">{m.destino || '-'}</td>
                        <td className="px-3 py-2 align-top max-w-xs break-words">
                          {m.observacao || '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div>
                Página{' '}
                <span className="font-semibold">
                  {movPage} / {movTotalPages}
                </span>
              </div>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setMovPage((p) => Math.max(1, p - 1))}
                  disabled={movPage <= 1}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setMovPage((p) => (p < movTotalPages ? p + 1 : p))}
                  disabled={movPage >= movTotalPages}
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>

          {/* Modal Catálogo SESMT */}
          {catalogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="flex max-h-[80vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-panel text-xs">
                <div className="flex items-center justify-between border-b border-border px-4 py-3 text-[11px]">
                  <div>
                    <div className="font-semibold">Catálogo SESMT</div>
                    <div className="text-muted">
                      Consulte os itens da planilha oficial (código, descrição, categoria, grupo, unidade, tamanho).
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1"
                    onClick={() => setCatalogOpen(false)}
                  >
                    Fechar
                  </button>
                </div>
                <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                  <input
                    className="flex-1 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Buscar por código, descrição ou grupo..."
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                  />
                  {catalogLoading && <span className="text-[11px] text-muted">Buscando...</span>}
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-[11px]">
                    <thead className="sticky top-0 border-b border-border bg-card/90 text-[10px] uppercase tracking-wide text-muted backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 text-left">Código</th>
                        <th className="px-3 py-2 text-left">Descrição</th>
                        <th className="px-3 py-2 text-left">Categoria</th>
                        <th className="px-3 py-2 text-left">Grupo</th>
                        <th className="px-3 py-2 text-left">Und.</th>
                        <th className="px-3 py-2 text-left">Tamanho</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {catalogItems.map((it, idx) => (
                        <tr
                          key={`${it.codigo_pa || ''}-${idx}`}
                          className="transition-colors hover:bg-white/5"
                        >
                          <td className="px-3 py-2 align-top">{it.codigo_pa || '-'}</td>
                          <td className="px-3 py-2 align-top">
                            {it.descricao_site || it.descricao_cahosp || '-'}
                          </td>
                          <td className="px-3 py-2 align-top">{it.categoria_site || '-'}</td>
                          <td className="px-3 py-2 align-top">{it.grupo_cahosp || '-'}</td>
                          <td className="px-3 py-2 align-top">{it.unidade_site || '-'}</td>
                          <td className="px-3 py-2 align-top">
                            {it.tamanho_site || it.tamanho || '-'}
                          </td>
                        </tr>
                      ))}
                      {!catalogLoading && catalogItems.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-6 text-center text-[11px] text-muted"
                          >
                            Nenhum item encontrado no catálogo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
{novoEpiAberto && (
  <div className="border-t border-border px-4 py-3 text-[11px] space-y-2">
    <div className="font-semibold">Cadastro rápido de novo EPI</div>
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <input
        className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Código CAHOSP (opcional)"
        value={novoCodigo}
        onChange={(e) => setNovoCodigo(e.target.value)}
      />
      <input
        className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Descrição do EPI"
        value={novoDescricao}
        onChange={(e) => setNovoDescricao(e.target.value)}
      />
      <input
        className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Categoria (ex.: Proteção respiratória)"
        value={novoCategoria}
        onChange={(e) => setNovoCategoria(e.target.value)}
      />
      <input
        className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Grupo (ex.: EPI)"
        value={novoGrupo}
        onChange={(e) => setNovoGrupo(e.target.value)}
      />
      <input
        className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Unidade (ex.: UN, PAR, CX)"
        value={novoUnidade}
        onChange={(e) => setNovoUnidade(e.target.value)}
      />
      <input
        className="rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Tamanho (ex.: P, M, G, Único)"
        value={novoTamanho}
        onChange={(e) => setNovoTamanho(e.target.value)}
      />
    </div>
    <div className="flex justify-end gap-2">
      <button
        type="button"
        className="rounded border border-border px-3 py-2"
        onClick={() => setNovoEpiAberto(false)}
        disabled={novoSalvando}
      >
        Cancelar
      </button>
      <button
        type="button"
        className="rounded bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleSalvarNovoEpi}
        disabled={novoSalvando || !novoDescricao.trim()}
      >
        {novoSalvando ? 'Salvando...' : 'Salvar novo EPI'}
      </button>
    </div>
  </div>
)}
<div className="flex items-center justify-between border-t border-border px-4 py-3 text-[11px]">
  <div>
    Itens exibidos: {catalogItems.length}
    {novoEpiAberto && (
      <span className="ml-2 text-[10px] text-muted">
        O EPI salvo já poderá ser usado nas movimentações.
      </span>
    )}
  </div>
  <button
    type="button"
    className="rounded border border-border px-3 py-2"
    onClick={() => setNovoEpiAberto((v) => !v)}
  >
    {novoEpiAberto ? 'Fechar cadastro rápido' : 'Cadastrar novo EPI'}
  </button>
</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
