
// lib/alterdata/schema.ts
export type SortDirection = "asc" | "desc";

export type Filters = {
  regional?: string;
  unidade?: string;
  cpf?: string;
  nome?: string;
  cargo?: string;
  funcao?: string;
  situacao?: string;
  admissaoFrom?: string; // yyyy-mm-dd
  admissaoTo?: string;   // yyyy-mm-dd
};

export type Pagination = {
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: SortDirection;
  afterId?: string;
};

export type QueryInput = {
  filters: Filters;
  pagination: Pagination;
};

const int = (v: any, def: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.floor(n);
};

const str = (v: any) => (typeof v === "string" ? v.trim() : undefined);

export function normalizeQuery(raw: any): QueryInput {
  const filters: Filters = {
    regional: str(raw?.filters?.regional),
    unidade: str(raw?.filters?.unidade),
    cpf: str(raw?.filters?.cpf)?.replace(/\D/g, ""),
    nome: str(raw?.filters?.nome),
    cargo: str(raw?.filters?.cargo),
    funcao: str(raw?.filters?.funcao),
    situacao: str(raw?.filters?.situacao),
    admissaoFrom: str(raw?.filters?.admissaoFrom),
    admissaoTo: str(raw?.filters?.admissaoTo),
  };

  const pageSizeRaw = int(raw?.pagination?.pageSize, 50);
  const pageSize = Math.min(Math.max(pageSizeRaw, 10), 500);

  const sortBy = str(raw?.pagination?.sortBy) || "nome";
  const sortDir: SortDirection = raw?.pagination?.sortDir === "desc" ? "desc" : "asc";

  const pagination: Pagination = {
    page: Math.max(1, int(raw?.pagination?.page, 1)),
    pageSize,
    sortBy,
    sortDir,
    afterId: str(raw?.pagination?.afterId),
  };

  return { filters, pagination };
}
