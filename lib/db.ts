
import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);

// Healthcheck
export async function ping() {
  const rows = await sql`select now() as now`;
  return rows[0]?.now as string;
}

// Ensures required helper tables exist without touching sources
export async function ensureAuxTables() {
  await sql`create table if not exists entregas_log (
    id bigserial primary key,
    colaborador_id text not null,
    unidade text not null,
    regional text not null,
    item text not null,
    quantidade int not null,
    responsavel text,
    created_at timestamptz default now()
  )`;

  await sql`create table if not exists colaborador_movimentos (
    id bigserial primary key,
    colaborador_id text not null,
    acao text not null,          -- mover_unidade | desligar | reativar | situacao
    de_unidade text,
    para_unidade text,
    situacao text,
    responsavel text,
    created_at timestamptz default now()
  )`;
}
