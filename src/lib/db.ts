import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL não definida. Configure no Vercel e no .env.local para dev.');
}

// Tag function para SQL (parâmetros interpolados com segurança).
export const sql = neon(url);
