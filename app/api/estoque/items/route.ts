// file: app/api/estoque/items/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import catalogo from '@/data/catalogo_sesmt.json';

async function ensureItemTable() {
  // Garante que a tabela item exista, alinhada ao modelo Prisma básico usado no sistema
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS item (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      categoria TEXT NOT NULL,
      ca TEXT NULL,
      descricao TEXT NULL,
      "unidadeMedida" TEXT NOT NULL,
      "validadeDias" INT NULL,
      ativo BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_item_nome_categoria ON item (nome, categoria);
    CREATE INDEX IF NOT EXISTS idx_item_categoria ON item (categoria);
  `);
}

export async function GET() {
  try {
    await ensureItemTable();

    // Sincroniza tabela Item com o catálogo SESMT (planilha)
    try {
      const countRows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
        `select count(*)::int as c from item`
      );
      const totalItens = Number(countRows?.[0]?.c ?? 0);
      const cat: any[] = (catalogo as any[]) || [];
      if (cat.length > 0 && totalItens < cat.length) {
        for (const it of cat) {
          const nome = String(it.descricao_site || it.descricao_cahosp || '').trim();
          if (!nome) continue;
          const categoria = String(it.categoria_site || it.grupo_cahosp || 'EPI').trim() || 'EPI';
          const unidade = String(it.unidade_site || 'UN').trim() || 'UN';
          const meta = JSON.stringify({
            codigo_pa: it.codigo_pa ?? null,
            grupo_cahosp: it.grupo_cahosp ?? null,
            tamanho: it.tamanho_site ?? it.tamanho ?? null,
          });
          await prisma.$executeRawUnsafe(
            `insert into item (id, nome, categoria, "unidadeMedida", descricao, ativo)
             values (substr(md5(random()::text || clock_timestamp()::text), 1, 24), $1, $2, $3, $4, true)
             on conflict (nome, categoria) do nothing`,
            nome,
            categoria,
            unidade,
            meta,
          );
        }
      }
    } catch (err) {
      console.error('Falha ao sincronizar Itens com catálogo SESMT', err);
    }

    const rows: any[] = await prisma.$queryRawUnsafe(`
      select id, nome
        from item
       where ativo = true
       order by nome
    `);

    const items = rows.map((r) => ({
      id: String(r.id),
      nome: (r.nome ?? '').toString(),
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error('Erro em /api/estoque/items', e);
    return NextResponse.json({ items: [], error: e?.message ?? 'Erro interno' });
  }
}
