// file: app/api/estoque/items/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import catalogo from '@/data/catalogo_sesmt.json';

export async function GET() {
  try {
    // Verifica se tabela item existe
    const tableExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `select true as exists
         from information_schema.tables
        where table_schema = current_schema()
          and table_name = 'item'
        limit 1`
    );
    if (!tableExists || tableExists.length === 0) {
      return NextResponse.json({ items: [] });
    }

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
      console.error('Falha ao sincronizar catálogo SESMT com tabela Item', err);
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      select id, nome
        from item
       where ativo = true
       order by nome
    `);

    const items = rows.map(r => ({
      id: String(r.id),
      nome: (r.nome ?? '').toString(),
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error('Erro em /api/estoque/items', e);
    return NextResponse.json({ items: [], error: e?.message ?? 'Erro interno' });
  }
}
