// file: app/api/estoque/items/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
