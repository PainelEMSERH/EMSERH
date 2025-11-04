
import { neon } from "@neondatabase/serverless";
export const sql = neon(process.env.DATABASE_URL!);
export async function ping() { const rows = await sql`select now() as now`; return rows[0]?.now as string; }
