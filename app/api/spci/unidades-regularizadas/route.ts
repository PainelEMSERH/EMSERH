import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calcularStatus } from '@/lib/spci/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type UnidadeResumo = {
  unidade: string;
  regional: string;
  total: number;
  ok: number;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const regional = searchParams.get('regional') || undefined;
    const unidade = searchParams.get('unidade') || undefined;

    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (regional) {
      queryParams.push(regional);
      whereConditions.push(`"Regional" = $${paramIndex}`);
      paramIndex++;
    }

    if (unidade) {
      queryParams.push(unidade);
      whereConditions.push(`TRIM("Unidade") ILIKE TRIM($${paramIndex})`);
      paramIndex++;
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const rowsSql = `
      SELECT
        "Unidade",
        "Regional",
        "Última recarga",
        "Data Execução Recarga"
      FROM spci_planilha
      ${whereSql}
    `;

    const rows =
      queryParams.length > 0
        ? await prisma.$queryRawUnsafe<any[]>(rowsSql, ...queryParams)
        : await prisma.$queryRawUnsafe<any[]>(rowsSql);

    const unidadesMap: Record<string, UnidadeResumo> = {};

    for (const row of rows) {
      const reg = String(row['Regional'] || 'Sem Regional').trim() || 'Sem Regional';
      const un = String(row['Unidade'] || 'Sem Unidade').trim() || 'Sem Unidade';
      const key = `${reg}::${un}`;

      if (!unidadesMap[key]) {
        unidadesMap[key] = { unidade: un, regional: reg, total: 0, ok: 0 };
      }

      const dataBaseStatus = row['Data Execução Recarga'] || row['Última recarga'];
      const calculo = calcularStatus(dataBaseStatus);
      unidadesMap[key].total++;
      if (calculo.status === 'OK') unidadesMap[key].ok++;
    }

    const unidadesRegularizadas = Object.values(unidadesMap)
      .filter((u) => u.total > 0 && u.ok === u.total)
      .sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR'));

    return NextResponse.json({
      ok: true,
      total: unidadesRegularizadas.length,
      rows: unidadesRegularizadas,
    });
  } catch (error: any) {
    console.error('spci/unidades-regularizadas error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao listar unidades regularizadas' },
      { status: 500 }
    );
  }
}
