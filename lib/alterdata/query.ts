
// lib/alterdata/query.ts
import { type QueryInput } from "./schema";

type Where = { sql: string; params: any[] };

export function buildWhere({ filters }: QueryInput): Where {
  const clauses: string[] = [];
  const params: any[] = [];
  let i = 1;

  const like = (v: string) => `%${v.toLowerCase()}%`;

  if (filters.regional) { clauses.push(`LOWER(regional) = LOWER($${i++})`); params.push(filters.regional); }
  if (filters.unidade)  { clauses.push(`LOWER(unidade) = LOWER($${i++})`); params.push(filters.unidade); }
  if (filters.cpf)      { clauses.push(`cpf = $${i++}`); params.push(filters.cpf.replace(/\D/g, "")); }
  if (filters.nome)     { clauses.push(`LOWER(nome) LIKE $${i++}`); params.push(like(filters.nome)); }
  if (filters.cargo)    { clauses.push(`LOWER(cargo) = LOWER($${i++})`); params.push(filters.cargo); }
  if (filters.funcao)   { clauses.push(`LOWER(funcao) = LOWER($${i++})`); params.push(filters.funcao); }
  if (filters.situacao) { clauses.push(`LOWER(situacao) = LOWER($${i++})`); params.push(filters.situacao); }

  if (filters.admissaoFrom) { clauses.push(`admissao >= $${i++}`); params.push(filters.admissaoFrom); }
  if (filters.admissaoTo)   { clauses.push(`admissao <= $${i++}`); params.push(filters.admissaoTo); }

  const sql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { sql, params };
}

export function buildOrder({ pagination }: QueryInput) {
  const allowed = new Set([
    "nome","cpf","regional","unidade","cargo","funcao","situacao","admissao","updated_at","id"
  ]);
  const col = allowed.has(pagination.sortBy) ? pagination.sortBy : "nome";
  const dir = pagination.sortDir === "desc" ? "DESC" : "ASC";
  return `ORDER BY ${col} ${dir}`;
}
