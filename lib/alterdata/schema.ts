
// lib/alterdata/schema.ts
import { z } from "zod";

export const SortDirection = z.enum(["asc", "desc"]);
export const SortField = z.string().min(1);

export const FiltersSchema = z.object({
  regional: z.string().optional(),
  unidade: z.string().optional(),
  cpf: z.string().trim().optional(),
  nome: z.string().trim().optional(),
  cargo: z.string().optional(),
  funcao: z.string().optional(),
  situacao: z.string().optional(),
  // datas no formato yyyy-mm-dd
  admissaoFrom: z.string().optional(),
  admissaoTo: z.string().optional(),
});

export type Filters = z.infer<typeof FiltersSchema>;

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(500).default(50),
  sortBy: SortField.default("nome"),
  sortDir: SortDirection.default("asc"),
  // keyset opcional
  afterId: z.string().optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const QuerySchema = z.object({
  filters: FiltersSchema.default({} as any),
  pagination: PaginationSchema.default({} as any),
});

export type QueryInput = z.infer<typeof QuerySchema>;
