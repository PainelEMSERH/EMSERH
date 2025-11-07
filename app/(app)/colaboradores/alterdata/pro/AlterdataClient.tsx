
// app/(app)/colaboradores/alterdata/pro/AlterdataClient.tsx
"use client";

import { useMemo, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FiltersSchema, PaginationSchema, QuerySchema, type Filters } from "@/lib/alterdata/schema";
import DataTablePro from "@/components/ui/DataTablePro";

function parseURL(search: URLSearchParams) {
  const filters: Filters = {
    regional: search.get("regional") || undefined,
    unidade: search.get("unidade") || undefined,
    cpf: search.get("cpf") || undefined,
    nome: search.get("nome") || undefined,
    cargo: search.get("cargo") || undefined,
    funcao: search.get("funcao") || undefined,
    situacao: search.get("situacao") || undefined,
    admissaoFrom: search.get("admissaoFrom") || undefined,
    admissaoTo: search.get("admissaoTo") || undefined,
  };
  const pagination = {
    page: Number(search.get("page") || 1),
    pageSize: Number(search.get("pageSize") || 50),
    sortBy: search.get("sortBy") || "nome",
    sortDir: (search.get("sortDir") || "asc") as "asc" | "desc",
  };
  return QuerySchema.parse({ filters, pagination });
}

function useAlterdataState() {
  const params = useSearchParams();
  const router = useRouter();
  const state = useMemo(() => parseURL(params), [params]);

  const setState = (next: Partial<ReturnType<typeof parseURL>>) => {
    const current = parseURL(params);
    const merged = { ...current, ...next, filters: { ...current.filters, ...(next as any)?.filters } };
    const sp = new URLSearchParams();
    Object.entries(merged.filters).forEach(([k, v]) => v && sp.set(k, String(v)));
    sp.set("page", String(merged.pagination.page));
    sp.set("pageSize", String(merged.pagination.pageSize));
    sp.set("sortBy", merged.pagination.sortBy);
    sp.set("sortDir", merged.pagination.sortDir);
    router.replace(`?${sp.toString()}`);
  };

  return [state, setState] as const;
}

function fetchPage(body: any) {
  return fetch("/api/alterdata/paginated", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "force-cache",
  }).then((r) => r.json());
}

function useAlterdataQuery(input: ReturnType<typeof parseURL>) {
  return useQuery({
    queryKey: ["alterdata", input],
    queryFn: () => fetchPage(input),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 12, // 12h
    refetchOnWindowFocus: false,
  });
}

function FilterBar({
  value,
  onChange,
}: {
  value: ReturnType<typeof parseURL>;
  onChange: (next: Partial<ReturnType<typeof parseURL>>) => void;
}) {
  // Mantido simples/protegido para não "bagunçar" filtros
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <input className="px-3 py-2 rounded-lg border w-full" placeholder="Nome" defaultValue={value.filters.nome || ""}
        onBlur={(e) => onChange({ filters: { ...value.filters, nome: e.target.value || undefined }, pagination: { ...value.pagination, page: 1 }})} />
      <input className="px-3 py-2 rounded-lg border w-full" placeholder="CPF" defaultValue={value.filters.cpf || ""}
        onBlur={(e) => onChange({ filters: { ...value.filters, cpf: e.target.value || undefined }, pagination: { ...value.pagination, page: 1 }})} />
      <input className="px-3 py-2 rounded-lg border w-full" placeholder="Regional" defaultValue={value.filters.regional || ""}
        onBlur={(e) => onChange({ filters: { ...value.filters, regional: e.target.value || undefined }, pagination: { ...value.pagination, page: 1 }})} />
      <input className="px-3 py-2 rounded-lg border w-full" placeholder="Unidade" defaultValue={value.filters.unidade || ""}
        onBlur={(e) => onChange({ filters: { ...value.filters, unidade: e.target.value || undefined }, pagination: { ...value.pagination, page: 1 }})} />
    </div>
  );
}

function Pager({
  value, onChange, totalCount, pageCount,
}: any) {
  return (
    <div className="flex items-center justify-between text-sm py-2">
      <div>Total: {totalCount?.toLocaleString?.() ?? 0}</div>
      <div className="flex gap-2 items-center">
        <button className="px-3 py-1.5 rounded-lg border" onClick={() => onChange({ pagination: { ...value.pagination, page: Math.max(1, value.pagination.page - 1) }})}>Anterior</button>
        <div>Página {value.pagination.page} / {pageCount ?? 1}</div>
        <button className="px-3 py-1.5 rounded-lg border" onClick={() => onChange({ pagination: { ...value.pagination, page: value.pagination.page + 1 }})}>Próxima</button>
        <select className="px-2 py-1.5 rounded-lg border" defaultValue={String(value.pagination.pageSize)}
          onChange={(e) => onChange({ pagination: { ...value.pagination, pageSize: Number(e.target.value), page: 1 } })}>
          {[25,50,100,200,500].map(n => <option key={n} value={n}>{n}/página</option>)}
        </select>
      </div>
    </div>
  );
}

function AlterdataView() {
  const [state, setState] = useAlterdataState();
  const q = useAlterdataQuery(state);

  useEffect(() => {
    // Pré-busca da próxima página (UX)
    if (q.data?.ok && state.pagination.page < (q.data.pageCount || 1)) {
      const next = { ...state, pagination: { ...state.pagination, page: state.pagination.page + 1 } };
      // prefetch com a mesma queryKey base
      // usar setTimeout para evitar colisão com render em lote
      setTimeout(() => {
        // nota: o prefetch é opcional; removido para simplificar se necessário
      }, 0);
    }
  }, [q.data, state]);

  return (
    <div className="flex flex-col gap-3">
      <FilterBar value={state} onChange={setState} />
      <Pager value={state} onChange={setState} totalCount={q.data?.totalCount} pageCount={q.data?.pageCount} />

      <div className="rounded-2xl border bg-background">
        <DataTablePro
          loading={q.isLoading}
          data={q.data?.rows || []}
          columns={[
            { key: "cpf", header: "CPF", width: 140, pin: "left" },
            { key: "nome", header: "Nome", width: 240, sortable: true },
            { key: "regional", header: "Regional", width: 160 },
            { key: "unidade", header: "Unidade", width: 220 },
            { key: "cargo", header: "Cargo", width: 200 },
            { key: "funcao", header: "Função", width: 200 },
            { key: "situacao", header: "Situação", width: 140 },
            { key: "admissao", header: "Admissão", width: 140 },
            { key: "updated_at", header: "Atualizado", width: 160 },
          ]}
          sortBy={state.pagination.sortBy}
          sortDir={state.pagination.sortDir}
          onSortChange={(s, d) => setState({ pagination: { ...state.pagination, sortBy: s, sortDir: d as any, page: 1 } })}
          height={600}
          rowHeight={44}
        />
      </div>

      <Pager value={state} onChange={setState} totalCount={q.data?.totalCount} pageCount={q.data?.pageCount} />
    </div>
  );
}

export default function AlterdataClient() {
  // Cria o QueryClient apenas uma vez por montagem
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AlterdataView />
    </QueryClientProvider>
  );
}
