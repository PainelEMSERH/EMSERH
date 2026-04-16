import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calcularStatus, parsePossuiContrato } from '@/lib/spci/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Função auxiliar para converter BigInt para Number (para serialização JSON)
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value);
    }
    return converted;
  }
  
  return obj;
}

/**
 * Retorna estatísticas/resumo dos extintores
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const regional = searchParams.get('regional') || undefined;
    const unidade = searchParams.get('unidade') || undefined;

    // Constrói WHERE clause
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (regional) {
      queryParams.push(regional);
      whereConditions.push(`"Regional" = $${paramIndex}`);
      paramIndex++;
    }

    if (unidade) {
      // Usa busca case-insensitive com TRIM
      queryParams.push(unidade);
      whereConditions.push(`TRIM("Unidade") ILIKE TRIM($${paramIndex})`);
      paramIndex++;
    }

    const whereSql = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Busca todos os registros (para calcular status)
    const rowsSql = `
      SELECT 
        id,
        "TAG",
        "Unidade",
        "Regional",
        "Última recarga",
        "Data Execução Recarga",
        "Possui Contrato"
      FROM spci_planilha
      ${whereSql}
    `;

    // Executa query - se não houver filtros, executa sem parâmetros
    let rows: any[];
    if (queryParams.length > 0) {
      rows = await prisma.$queryRawUnsafe<any[]>(rowsSql, ...queryParams);
    } else {
      rows = await prisma.$queryRawUnsafe<any[]>(rowsSql);
    }
    
    // Converte BigInt para Number para evitar erro de serialização
    rows = convertBigIntToNumber(rows);

    // Calcula estatísticas
    let total = 0;
    let totalVencidos = 0;
    let totalAVencer = 0;
    let totalSemContrato = 0;
    const porRegional: Record<string, number> = {};
    const unidadesMap: Record<
      string,
      { unidade: string; regional: string; total: number; ok: number; vencidos: number; avencer: number }
    > = {};

    for (const row of rows) {
      total++;
      
      // Status deve considerar a recarga mais recente.
      const dataBaseStatus = row['Data Execução Recarga'] || row['Última recarga'];
      const calculo = calcularStatus(dataBaseStatus);
      if (calculo.status === 'VENCIDO') totalVencidos++;
      if (calculo.status === 'A VENCER') totalAVencer++;
      
      // Conta sem contrato
      if (!parsePossuiContrato(row['Possui Contrato'])) {
        totalSemContrato++;
      }
      
      // Conta por regional
      const reg = row['Regional'] || 'Sem Regional';
      porRegional[reg] = (porRegional[reg] || 0) + 1;

      // Consolida por unidade para KPI de "100% regularizada"
      const un = String(row['Unidade'] || 'Sem Unidade').trim() || 'Sem Unidade';
      const key = `${reg}::${un}`;
      if (!unidadesMap[key]) {
        unidadesMap[key] = { unidade: un, regional: reg, total: 0, ok: 0, vencidos: 0, avencer: 0 };
      }
      unidadesMap[key].total++;
      if (calculo.status === 'OK') unidadesMap[key].ok++;
      if (calculo.status === 'VENCIDO') unidadesMap[key].vencidos++;
      if (calculo.status === 'A VENCER') unidadesMap[key].avencer++;
    }

    const unidades = Object.values(unidadesMap);
    const unidadesRegularizadas = unidades.filter((u) => u.total > 0 && u.ok === u.total).length;
    const totalUnidades = unidades.length;
    const pctUnidadesRegularizadas = totalUnidades > 0 ? (unidadesRegularizadas / totalUnidades) * 100 : 0;

    const unidadesRegularizadasPorRegional: Record<string, { regularizadas: number; total: number; pct: number }> = {};
    for (const u of unidades) {
      if (!unidadesRegularizadasPorRegional[u.regional]) {
        unidadesRegularizadasPorRegional[u.regional] = { regularizadas: 0, total: 0, pct: 0 };
      }
      unidadesRegularizadasPorRegional[u.regional].total++;
      if (u.total > 0 && u.ok === u.total) unidadesRegularizadasPorRegional[u.regional].regularizadas++;
    }
    for (const reg of Object.keys(unidadesRegularizadasPorRegional)) {
      const item = unidadesRegularizadasPorRegional[reg];
      item.pct = item.total > 0 ? (item.regularizadas / item.total) * 100 : 0;
    }

    return NextResponse.json({
      ok: true,
      stats: {
        total,
        totalVencidos,
        totalAVencer,
        totalSemContrato,
        porRegional,
        unidadesRegularizadas,
        totalUnidades,
        pctUnidadesRegularizadas,
        unidadesRegularizadasPorRegional,
      },
    });
  } catch (error: any) {
    console.error('spci/stats error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Erro ao calcular estatísticas' },
      { status: 500 }
    );
  }
}
