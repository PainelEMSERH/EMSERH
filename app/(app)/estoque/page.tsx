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


type VisaoResumo = {
  totalItensEstoque: number;
  totalSaldo: number;
  entradas30d: number;
  saidas30d: number;
};

type VisaoItemSaldo = {
  item: string;
  saldo: number;
};

type VisaoItemSaida = {
  item: string;
  quantidade: number;
};

type VisaoAlerta = {
  item: string;
  saldo: number;
  nivel: 'SEM_ESTOQUE' | 'BAIXO';
};

type VisaoResponse = {
  resumo: VisaoResumo | null;
  saldoPorItem: VisaoItemSaldo[];
  topSaidas30d: VisaoItemSaida[];
  alertas: VisaoAlerta[];
};
type PedidoItemDraft = {
  id: string;
  itemId: string | null;
  descricao: string;
  grupo: string | null;
  subgrupo: string | null;
  tamanho: string | null;
  unidadeMedida: string | null;
  quantidade: number;
};

type PedidoRow = {
  id: string;
  data_pedido: string;
  regional: string;
  solicitante_tipo: 'UNIDADE' | 'SESMT';
  unidade_solicitante: string | null;
  numero_cahosp: string | null;
  responsavel: string | null;
  status: string;
  observacao: string | null;
  total_itens: number;
  total_qtd: number;
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

function toInputDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [editingMov, setEditingMov] = useState<MovRow | null>(null);

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


  // Pedidos de reposição
  const [pedidoSolicitanteTipo, setPedidoSolicitanteTipo] = useState<'UNIDADE' | 'SESMT'>('UNIDADE');
  const [pedidoUnidade, setPedidoUnidade] = useState<string>('');
  const [pedidoData, setPedidoData] = useState<string>('');
  const [pedidoResponsavel, setPedidoResponsavel] = useState<string>('');
  const [pedidoNumeroCahosp, setPedidoNumeroCahosp] = useState<string>('');
  const [pedidoObs, setPedidoObs] = useState<string>('');
  const [pedidoItens, setPedidoItens] = useState<PedidoItemDraft[]>([]);
  const [pedidoSaving, setPedidoSaving] = useState(false);

  const [pedidoLista, setPedidoLista] = useState<PedidoRow[]>([]);
  const [pedidoTotal, setPedidoTotal] = useState(0);
  const [pedidoPage, setPedidoPage] = useState(1);
  const pedidoSize = 20;
  const [pedidoLoading, setPedidoLoading] = useState(false);

  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [pedidoCatalogQuery, setPedidoCatalogQuery] = useState('');
  const [pedidoCatalogItems, setPedidoCatalogItems] = useState<CatalogItem[]>([]);
  const [pedidoCatalogLoading, setPedidoCatalogLoading] = useState(false);
  const [pedidoQuantidadePorItem, setPedidoQuantidadePorItem] = useState<Record<string, string>>({});


  // Visão geral
  const [visResumo, setVisResumo] = useState<VisaoResumo | null>(null);
  const [visSaldoItens, setVisSaldoItens] = useState<VisaoItemSaldo[]>([]);
  const [visTopSaidas, setVisTopSaidas] = useState<VisaoItemSaida[]>([]);
  const [visAlertas, setVisAlertas] = useState<VisaoAlerta[]>([]);
  const [visLoading, setVisLoading] = useState(false);

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


  // Busca itens para o modal de itens do pedido
  useEffect(() => {
    if (!pedidoModalOpen) return;
    if (!pedidoCatalogQuery.trim()) {
      setPedidoCatalogItems([]);
      return;
    }
    let active = true;
    setPedidoCatalogLoading(true);
    const url = `/api/estoque/catalogo?q=${encodeURIComponent(pedidoCatalogQuery.trim())}`;
    fetchJSON<{ items: CatalogItem[] }>(url)
      .then((d) => {
        if (!active) return;
        setPedidoCatalogItems(d.items || []);
      })
      .catch(() => {
        if (!active) return;
        setPedidoCatalogItems([]);
      })
      .finally(() => {
        if (!active) return;
        setPedidoCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pedidoModalOpen, pedidoCatalogQuery]);

  
// Carrega lista de pedidos de reposição para a Regional selecionada
  useEffect(() => {
    if (!regional) {
      setPedidoLista([]);
      setPedidoTotal(0);
      return;
    }

    setPedidoLoading(true);
    const url = `/api/estoque/pedidos?regionalId=${encodeURIComponent(
      regional,
    )}&page=${pedidoPage}&size=${pedidoSize}`;
    fetchJSON<{ rows: PedidoRow[]; total: number }>(url)
      .then((d) => {
        setPedidoLista(d.rows || []);
        setPedidoTotal(d.total || 0);
      })
      .catch(() => {
        setPedidoLista([]);
        setPedidoTotal(0);
      })
      .finally(() => setPedidoLoading(false));
  }, [regional, pedidoPage]);

  // Carrega visão geral da Regional selecionada
  useEffect(() => {
    if (!regional) {
      setVisResumo(null);
      setVisSaldoItens([]);
      setVisTopSaidas([]);
      setVisAlertas([]);
      return;
    }

    let active = true;
    setVisLoading(true);
    const url = `/api/estoque/visao?regionalId=${encodeURIComponent(regional)}`;
    fetchJSON<VisaoResponse>(url)
      .then((d) => {
        if (!active) return;
        setVisResumo(d.resumo || null);
        setVisSaldoItens(d.saldoPorItem || []);
        setVisTopSaidas(d.topSaidas30d || []);
        setVisAlertas(d.alertas || []);
      })
      .catch(() => {
        if (!active) return;
        setVisResumo(null);
        setVisSaldoItens([]);
        setVisTopSaidas([]);
        setVisAlertas([]);
      })
      .finally(() => {
        if (!active) return;
        setVisLoading(false);
      });

    return () => {
      active = false;
    };
  }, [regional]);

  const isEditing = !!editingMov;

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

function buildPedidoItemKey(item: CatalogItem) {
  const base =
    item.codigo_pa ||
    item.descricao_site ||
    item.descricao_cahosp ||
    '';
  const tamanho = item.tamanho_site || item.tamanho || '';
  return `${base}::${tamanho}`;
}

function normalizarTextoPedido(s: string | null | undefined) {
  return (s || '').toString().trim() || null;
}

async function handleSalvarPedido() {
  if (!regional) {
    alert('Selecione uma Regional para registrar o pedido.');
    return;
  }

  if (pedidoSolicitanteTipo === 'UNIDADE' && !pedidoUnidade) {
    alert('Informe a Unidade solicitante.');
    return;
  }

  if (!pedidoItens.length) {
    alert('Adicione ao menos um item ao pedido.');
    return;
  }

  try {
    setPedidoSaving(true);

    const body = {
      regionalId: regional,
      solicitanteTipo: pedidoSolicitanteTipo,
      unidade: pedidoSolicitanteTipo === 'UNIDADE' ? pedidoUnidade : null,
      data: pedidoData || null,
      responsavel: normalizarTextoPedido(pedidoResponsavel),
      numeroCahosp: normalizarTextoPedido(pedidoNumeroCahosp),
      observacao: normalizarTextoPedido(pedidoObs),
      itens: pedidoItens.map((it) => ({
        itemId: it.itemId,
        descricao: it.descricao,
        grupo: it.grupo,
        subgrupo: it.subgrupo,
        tamanho: it.tamanho,
        unidadeMedida: it.unidadeMedida,
        quantidade: it.quantidade,
      })),
    };

    await fetchJSON('/api/estoque/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Limpa formulário de pedido
    setPedidoItens([]);
    setPedidoObs('');
    setPedidoNumeroCahosp('');
    setPedidoResponsavel('');
    setPedidoData('');
    setPedidoUnidade('');
    setPedidoSolicitanteTipo('UNIDADE');
    setPedidoPage(1);

    // Recarrega lista
    const url = `/api/estoque/pedidos?regionalId=${encodeURIComponent(
      regional,
    )}&page=1&size=${pedidoSize}`;
    const d = await fetchJSON<{ rows: PedidoRow[]; total: number }>(url);
    setPedidoLista(d.rows || []);
    setPedidoTotal(d.total || 0);
  } catch (e: any) {
    console.error(e);
    alert(e?.message || 'Erro ao salvar pedido de reposição.');
  } finally {
    setPedidoSaving(false);
  }
}

function handleAdicionarItensDoCatalogo() {
  if (!pedidoCatalogItems.length) {
    alert('Busque e selecione ao menos um item.');
    return;
  }

  const novos: PedidoItemDraft[] = [];

  for (const item of pedidoCatalogItems) {
    const key = buildPedidoItemKey(item);
    const qStr = pedidoQuantidadePorItem[key];
    const qtd = Number(qStr || 0);
    if (!Number.isFinite(qtd) || qtd <= 0) continue;

    const descricao =
      item.descricao_site ||
      item.descricao_cahosp ||
      item.codigo_pa ||
      '';
    if (!descricao) continue;

    const grupo = item.grupo_cahosp || item.categoria_site || null;
    const subgrupo = item.categoria_site || null;
    const tamanho = item.tamanho_site || item.tamanho || null;
    const unidadeMedida = item.unidade_site || null;

    const id = `${descricao}-${tamanho || ''}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    novos.push({
      id,
      itemId: item.codigo_pa,
      descricao,
      grupo,
      subgrupo,
      tamanho,
      unidadeMedida,
      quantidade: qtd,
    });
  }

  if (!novos.length) {
    alert('Informe quantidade para pelo menos um item.');
    return;
  }

  setPedidoItens((prev) => [...prev, ...novos]);
  setPedidoQuantidadePorItem({});
  setPedidoCatalogItems([]);
  setPedidoCatalogQuery('');
  setPedidoModalOpen(false);
}


  async function handleSalvarMovimentacao() {
    if (!canSave) return;
    try {
      setSaving(true);

      const qtd = Number(quantidade || 0);
      const unidadeNome = unidadeSESMTNome;

      const partesObs: string[] = [];
      if (tipo === 'entrada') {
        if (numeroPedido) partesObs.push(`Pedido CAHOSP: ${numeroPedido}`);
        if (responsavel) partesObs.push(`Recebido por: ${responsavel}`);
      } else {
        if (responsavel) partesObs.push(`Entregue por: ${responsavel}`);
      }
      if (observacao) partesObs.push(observacao);
      const obsFinal = partesObs.join(' | ') || null;

      if (editingMov) {
        await fetchJSON('/api/estoque/mov', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingMov.id,
            quantidade: qtd,
            observacao: obsFinal,
            data: dataMov || null,
          }),
        });
      } else {
        const destino =
          tipo === 'entrada'
            ? 'Entrada no estoque do SESMT (CAHOSP → SESMT)'
            : destinoUnidade || null;

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
      }

      // Limpa campos específicos e sai do modo edição (se ativo)
      setEditingMov(null);
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
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao salvar movimentação.');
    } finally {
      setSaving(false);
    }
  }

  const movTotalPages = useMemo(() => {
    return movTotal > 0 ? Math.ceil(movTotal / movSize) : 1;
  }, [movTotal]);

  const canSalvarPedido = useMemo(() => {
    if (!regional) return false;
    if (pedidoSolicitanteTipo === 'UNIDADE' && !pedidoUnidade) return false;
    if (!pedidoItens.length) return false;
    return true;
  }, [regional, pedidoSolicitanteTipo, pedidoUnidade, pedidoItens.length]);

  const pedidoTotalPages = useMemo(() => {
    return pedidoTotal > 0 ? Math.ceil(pedidoTotal / pedidoSize) : 1;
  }, [pedidoTotal, pedidoSize]);

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
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-panel p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Visão geral do estoque SESMT</h2>
                <p className="text-[11px] text-muted">
                  Panorama consolidado da Regional selecionada: saldo no estoque SESMT, movimentações recentes e alertas de estoque baixo.
                </p>
              </div>
              {!regional && (
                <span className="text-[11px] text-muted">
                  Selecione uma Regional para visualizar o painel geral.
                </span>
              )}
              {regional && (
                <div className="text-right text-[11px] text-muted">
                  Regional:{' '}
                  <span className="font-semibold text-text">{regional}</span>
                  <br />
                  Estoque SESMT:{' '}
                  <span className="font-semibold text-text">
                    {canonUnidade(`ESTOQUE SESMT - ${regional}`)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {regional && (
            <>
              {/* Cards de resumo */}
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Itens diferentes em estoque</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {visResumo?.totalItensEstoque ?? 0}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">
                    Considerando apenas o estoque do SESMT da Regional.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Saldo total no estoque SESMT</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {visResumo?.totalSaldo ?? 0}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">
                    Soma das quantidades de todos os itens (entradas - saídas).
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Entradas (últimos 30 dias)</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-300">
                    {visResumo?.entradas30d ?? 0}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">
                    Total de EPIs recebidos pela Regional no período.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Saídas (últimos 30 dias)</p>
                  <p className="mt-1 text-2xl font-semibold text-red-200">
                    {visResumo?.saidas30d ?? 0}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">
                    Total de EPIs enviados às Unidades no período.
                  </p>
                </div>
              </div>

              {/* Tabelas principais */}
              <div className="grid gap-4 lg:grid-cols-3">
                {/* Saldo por item */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-panel p-4 text-xs">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">Saldo por item no estoque SESMT</h3>
                      <p className="text-[11px] text-muted">
                        Entradas menos saídas para cada item, apenas no estoque do SESMT.
                      </p>
                    </div>
                    {visLoading && (
                      <span className="text-[11px] text-muted">Atualizando...</span>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-border bg-card">
                    <table className="min-w-full text-[11px]">
                      <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visSaldoItens.length === 0 && (
                          <tr>
                            <td
                              colSpan={2}
                              className="px-3 py-6 text-center text-[11px] text-muted"
                            >
                              Nenhum registro de estoque para esta Regional.
                            </td>
                          </tr>
                        )}
                        {visSaldoItens.map((row) => (
                          <tr key={row.item} className="border-t border-border/60">
                            <td className="px-3 py-2 align-top">{row.item}</td>
                            <td className="px-3 py-2 text-right align-top">{row.saldo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-2 text-[10px] text-muted">
                    Legenda de alerta: itens com saldo &le; 0 aparecem como &quot;Sem estoque&quot;
                    na lista de alertas; saldo entre 1 e 50 aparece como &quot;Atenção - estoque baixo&quot;.
                  </p>
                </div>

                {/* Alertas e top saídas */}
                <div className="space-y-4 text-xs">
                  <div className="rounded-xl border border-border bg-panel p-4">
                    <h3 className="text-sm font-semibold">Alertas de estoque baixo</h3>
                    <p className="mb-2 text-[11px] text-muted">
                      Itens com saldo baixo ou zerado no estoque SESMT.
                    </p>
                    {visAlertas.length === 0 && (
                      <p className="py-4 text-[11px] text-muted">
                        Nenhum alerta de estoque baixo para esta Regional.
                      </p>
                    )}
                    {visAlertas.length > 0 && (
                      <ul className="space-y-2">
                        {visAlertas.map((a) => (
                          <li
                            key={a.item}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2"
                          >
                            <div className="flex-1">
                              <div className="text-[11px] font-medium">{a.item}</div>
                              <div className="text-[10px] text-muted">
                                Saldo atual: {a.saldo}
                              </div>
                            </div>
                            <span
                              className={
                                a.nivel === 'SEM_ESTOQUE'
                                  ? 'rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] font-semibold text-red-100'
                                  : 'rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-100'
                              }
                            >
                              {a.nivel === 'SEM_ESTOQUE'
                                ? 'Sem estoque'
                                : 'Atenção'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-panel p-4">
                    <h3 className="text-sm font-semibold">Itens mais saídos (últimos 30 dias)</h3>
                    <p className="mb-2 text-[11px] text-muted">
                      Principais itens enviados às Unidades nesta Regional.
                    </p>
                    {visTopSaidas.length === 0 && (
                      <p className="py-4 text-[11px] text-muted">
                        Nenhuma saída registrada nos últimos 30 dias.
                      </p>
                    )}
                    {visTopSaidas.length > 0 && (
                      <ul className="space-y-2">
                        {visTopSaidas.map((s) => (
                          <li
                            key={s.item}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2"
                          >
                            <span className="text-[11px]">{s.item}</span>
                            <span className="text-[11px] font-semibold">{s.quantidade}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'ped' && (
        <div className="space-y-4">
          {/* Novo pedido de reposição */}
          <div className="rounded-xl border border-border bg-panel p-4 text-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Novo pedido de reposição</h2>
                <p className="text-[11px] text-muted">
                  Registre solicitações das Unidades e pedidos de reposição de estoque do SESMT para acompanhar cada etapa.
                </p>
              </div>
              <a
                href="https://gmed.emserh.ma.gov.br/login"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border border-emerald-500 px-3 py-2 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/10"
              >
                Solicite o pedido de reposição na CAHOSP
              </a>
            </div>

            {/* Linha 1: quem solicitou + unidade solicitante */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium">Quem solicitou?</span>
                <select
                  className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  value={pedidoSolicitanteTipo}
                  onChange={(e) =>
                    setPedidoSolicitanteTipo(e.target.value === 'SESMT' ? 'SESMT' : 'UNIDADE')
                  }
                >
                  <option value="UNIDADE">Unidade hospitalar</option>
                  <option value="SESMT">Reposição de estoque do SESMT</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 md:col-span-2">
                <span className="font-medium">Unidade solicitante</span>
                {pedidoSolicitanteTipo === 'UNIDADE' ? (
                  <select
                    className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                    value={pedidoUnidade}
                    onChange={(e) => setPedidoUnidade(e.target.value)}
                    disabled={!regional}
                  >
                    <option value="">
                      {regional ? 'Selecione a Unidade...' : 'Selecione uma Regional primeiro'}
                    </option>
                    {regional &&
                      opts.unidades
                        .filter((u) => u.regional === regional)
                        .map((u) => (
                          <option key={u.unidade} value={u.unidade}>
                            {u.unidade}
                          </option>
                        ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="rounded border border-border bg-muted px-3 py-2 text-xs outline-none"
                    value={regional ? `Estoque SESMT - ${regional}` : 'Selecione uma Regional'}
                    readOnly
                  />
                )}
              </div>
            </div>

            {/* Linha 2: data, responsável, nº pedido CAHOSP */}
            <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-4">
              <div className="flex flex-col gap-1">
                <span className="font-medium">Data do pedido</span>
                <input
                  type="date"
                  className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  value={pedidoData}
                  onChange={(e) => setPedidoData(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <span className="font-medium">Responsável</span>
                <input
                  type="text"
                  className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome de quem está registrando o pedido"
                  value={pedidoResponsavel}
                  onChange={(e) => setPedidoResponsavel(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-medium">Nº do pedido CAHOSP</span>
                <input
                  type="text"
                  className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Preencha após registrar no portal CAHOSP"
                  value={pedidoNumeroCahosp}
                  onChange={(e) => setPedidoNumeroCahosp(e.target.value)}
                />
              </div>
            </div>

            {/* Observação */}
            <div className="pt-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium">Observação</span>
                <textarea
                  className="min-h-[60px] rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  maxLength={240}
                  placeholder="Comentários gerais sobre o pedido (opcional)"
                  value={pedidoObs}
                  onChange={(e) => setPedidoObs(e.target.value)}
                />
                <span className="text-[10px] text-muted">
                  Máx. 240 caracteres. Use para detalhes rápidos sobre o contexto do pedido.
                </span>
              </div>
            </div>

            {/* Itens do pedido */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">Itens do pedido</span>
                  <p className="text-[11px] text-muted">
                    Selecione os EPIs a partir do catálogo, informando a quantidade para cada item.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPedidoModalOpen(true)}
                  className="rounded-lg border border-border px-3 py-2 text-[11px] font-medium hover:bg-card"
                >
                  Adicionar itens ao pedido
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Grupo</th>
                      <th className="px-3 py-2 text-left">Subgrupo</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Tamanho</th>
                      <th className="px-3 py-2 text-left">Unidade</th>
                      <th className="px-3 py-2 text-right">Qtd</th>
                      <th className="px-3 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidoItens.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-6 text-center text-[11px] text-muted"
                        >
                          Nenhum item adicionado ao pedido.
                        </td>
                      </tr>
                    )}
                    {pedidoItens.map((it) => (
                      <tr key={it.id} className="border-t border-border/60">
                        <td className="px-3 py-2 align-top">{it.grupo || '-'}</td>
                        <td className="px-3 py-2 align-top">{it.subgrupo || '-'}</td>
                        <td className="px-3 py-2 align-top">{it.descricao}</td>
                        <td className="px-3 py-2 align-top">{it.tamanho || '-'}</td>
                        <td className="px-3 py-2 align-top">{it.unidadeMedida || '-'}</td>
                        <td className="px-3 py-2 text-right align-top">{it.quantidade}</td>
                        <td className="px-3 py-2 text-right align-top">
                          <button
                            type="button"
                            className="rounded border border-border px-2 py-1 text-[10px] hover:bg-card"
                            onClick={() =>
                              setPedidoItens((prev) => prev.filter((row) => row.id !== it.id))
                            }
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSalvarPedido}
                  disabled={!canSalvarPedido || pedidoSaving}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    !canSalvarPedido || pedidoSaving
                      ? 'cursor-not-allowed bg-emerald-900/40 text-muted'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  {pedidoSaving ? 'Salvando pedido...' : 'Salvar pedido de reposição'}
                </button>
              </div>
            </div>
          </div>

          {/* Lista de pedidos registrados */}
          <div className="rounded-xl border border-border bg-panel p-4 text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Pedidos registrados</h2>
                <p className="text-[11px] text-muted">
                  Histórico de pedidos de reposição da Regional selecionada.
                </p>
              </div>
              <div className="text-[11px] text-muted">
                Total:{' '}
                <span className="font-semibold">
                  {pedidoTotal}
                </span>{' '}
                pedidos
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="min-w-full text-[11px]">
                <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Quem solicitou</th>
                    <th className="px-3 py-2 text-left">Unidade</th>
                    <th className="px-3 py-2 text-right">Itens</th>
                    <th className="px-3 py-2 text-right">Qtd total</th>
                    <th className="px-3 py-2 text-left">Nº CAHOSP</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidoLoading && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted">
                        Carregando pedidos...
                      </td>
                    </tr>
                  )}
                  {!pedidoLoading && pedidoLista.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted">
                        Nenhum pedido cadastrado para a Regional selecionada.
                      </td>
                    </tr>
                  )}
                  {!pedidoLoading &&
                    pedidoLista.map((p) => (
                      <tr key={p.id} className="border-t border-border/60">
                        <td className="px-3 py-2 align-top">
                          {formatDate(p.data_pedido)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {p.solicitante_tipo === 'UNIDADE' ? 'Unidade hospitalar' : 'SESMT'}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {p.unidade_solicitante || (p.solicitante_tipo === 'SESMT'
                            ? `Estoque SESMT - ${p.regional}`
                            : '-')}
                        </td>
                        <td className="px-3 py-2 text-right align-top">{p.total_itens}</td>
                        <td className="px-3 py-2 text-right align-top">{p.total_qtd}</td>
                        <td className="px-3 py-2 align-top">
                          {p.numero_cahosp || '-'}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {p.status || 'ABERTO'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 text-[11px]">
              <div>
                Página{' '}
                <span className="font-semibold">
                  {pedidoPage} / {pedidoTotalPages}
                </span>
              </div>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 disabled:opacity-40"
                  onClick={() => setPedidoPage((p) => Math.max(1, p - 1))}
                  disabled={pedidoPage <= 1}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 disabled:opacity-40"
                  onClick={() =>
                    setPedidoPage((p) =>
                      p >= pedidoTotalPages ? pedidoTotalPages : p + 1,
                    )
                  }
                  disabled={pedidoPage >= pedidoTotalPages}
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>

          {/* Modal: seleção de itens para o pedido */}
          {pedidoModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-panel text-xs shadow-lg">
                <div className="flex items-start justify-between gap-3 border-b border-border bg-card px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">Selecionar itens para o pedido</div>
                    <div className="text-[11px] text-muted">
                      Busque principalmente pelo nome do EPI (por exemplo: máscara, luva, avental). Os campos de grupo, tamanho e código servem apenas para conferência. Informe a quantidade para cada item a ser incluído.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 text-[10px] hover:bg-card"
                    onClick={() => setPedidoModalOpen(false)}
                  >
                    Fechar
                  </button>
                </div>

                <div className="flex flex-col gap-3 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      className="w-full flex-1 rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Digite parte do nome do EPI (ex.: máscara, luva, avental...)"
                      value={pedidoCatalogQuery}
                      onChange={(e) => setPedidoCatalogQuery(e.target.value)}
                    />
                    <span className="text-[11px] text-muted">
                      Resultados: {pedidoCatalogItems.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Informe quantidades em quantos itens precisar e depois clique em
                    &quot;Adicionar itens selecionados&quot; para incluir tudo de uma vez.
                  </p>

                  <div className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-card">
                    <table className="min-w-full text-[11px]">
                      <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">Grupo</th>
                          <th className="px-3 py-2 text-left">Subgrupo</th>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-left">Tamanho</th>
                          <th className="px-3 py-2 text-left">Unidade</th>
                          <th className="px-3 py-2 text-left">Código</th>
                          <th className="px-3 py-2 text-right">Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidoCatalogLoading && (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-3 py-6 text-center text-muted"
                            >
                              Carregando catálogo...
                            </td>
                          </tr>
                        )}
                        {!pedidoCatalogLoading && pedidoCatalogItems.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-3 py-6 text-center text-muted"
                            >
                              Nenhum item encontrado. Ajuste a busca.
                            </td>
                          </tr>
                        )}
                        {!pedidoCatalogLoading &&
                          pedidoCatalogItems.map((item) => {
                            const key = buildPedidoItemKey(item);
                            const qtd = pedidoQuantidadePorItem[key] || '';
                            return (
                              <tr key={key} className="border-t border-border/60">
                                <td className="px-3 py-2 align-top">
                                  {item.grupo_cahosp || item.categoria_site || '-'}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {item.categoria_site || '-'}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {item.descricao_site || item.descricao_cahosp || '-'}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {item.tamanho_site || item.tamanho || '-'}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {item.unidade_site || '-'}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  {item.codigo_pa || '-'}
                                </td>
                                <td className="px-3 py-2 text-right align-top">
                                  <input
                                    type="number"
                                    min={0}
                                    className="w-20 rounded border border-border bg-background px-2 py-1 text-right text-[11px] outline-none focus:ring-1 focus:ring-emerald-500"
                                    value={qtd}
                                    onChange={(e) =>
                                      setPedidoQuantidadePorItem((prev) => ({
                                        ...prev,
                                        [key]: e.target.value,
                                      }))
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      className="rounded border border-border px-3 py-2 text-[11px] hover:bg-card"
                      onClick={() => {
                        setPedidoModalOpen(false);
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white hover:bg-emerald-500"
                      onClick={handleAdicionarItensDoCatalogo}
                    >
                      Adicionar itens selecionados
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                    } ${isEditing ? 'opacity-40 cursor-not-allowed' : ''}`}
                    onClick={() => {
                      if (isEditing) return;
                      setTipo('saida');
                    }}
                    disabled={isEditing}
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
                {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar movimentação'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMov(null);
                    setTipo('entrada');
                    setItemId('');
                    setQuantidade('');
                    setDataMov('');
                    setDestinoUnidade('');
                    setNumeroPedido('');
                    setResponsavel('');
                    setObservacao('');
                  }}
                  disabled={saving}
                  className="ml-2 rounded-lg border border-border px-3 py-2 text-[11px] hover:bg-card"
                >
                  Cancelar edição
                </button>
              )}
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
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {movLoading && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-muted">
                        Carregando movimentações...
                      </td>
                    </tr>
                  )}
                  {!movLoading && movRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-muted">
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
                        <td className="px-3 py-2 align-top text-right">
                          {m.tipo === 'entrada' && (
                            <button
                              type="button"
                              className="rounded border border-border px-2 py-1 text-[10px] hover:bg-card"
                              onClick={() => {
                                setEditingMov(m);
                                setTipo('entrada');
                                setItemId(m.itemId);
                                setQuantidade(String(m.quantidade));
                                setDataMov(toInputDate(m.data));
                                setDestinoUnidade('');
                                setNumeroPedido('');
                                setResponsavel('');
                                setObservacao(m.observacao || '');
                                if (typeof window !== 'undefined' && window.scrollTo) {
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }
                              }}
                            >
                              Editar
                            </button>
                          )}
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
