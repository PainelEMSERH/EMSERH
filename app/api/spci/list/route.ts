import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calcularStatus, parseDateBR, formatDateBR } from '@/lib/spci/utils';

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

interface QueryParams {
  page?: number;
  pageSize?: number;
  regional?: string;
  unidade?: string;
  status?: string;
  possuiContrato?: string;
  classe?: string;
  anoPlanejamento?: number;
  search?: string; // Busca por TAG ou Nº série
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    const params: QueryParams = {
      page: Math.max(1, Number(searchParams.get('page') || 1)),
      pageSize: Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 25))),
      regional: searchParams.get('regional') || undefined,
      unidade: searchParams.get('unidade') || undefined,
      status: searchParams.get('status') || undefined,
      possuiContrato: searchParams.get('possuiContrato') || undefined,
      classe: searchParams.get('classe') || undefined,
      anoPlanejamento: searchParams.get('anoPlanejamento') ? Number(searchParams.get('anoPlanejamento')) : undefined,
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'TAG',
      sortDir: (searchParams.get('sortDir') || 'asc') as 'asc' | 'desc',
    };

    // Constrói WHERE clause
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params.regional) {
      // Usa comparação direta (sem TRIM) para manter consistência com a API de stats
      // A API de stats funciona com essa abordagem, então vamos manter igual
      queryParams.push(params.regional);
      whereConditions.push(`"Regional" = $${paramIndex}`);
      paramIndex++;
    }

    if (params.unidade) {
      // Usa busca case-insensitive com TRIM
      // Usa ILIKE para busca flexível (pode usar % para busca parcial)
      const unidadeParam = params.unidade.trim();
      queryParams.push(unidadeParam);
      whereConditions.push(`TRIM("Unidade") ILIKE TRIM($${paramIndex})`);
      paramIndex++;
    }

    if (params.classe) {
      queryParams.push(params.classe.trim());
      whereConditions.push(`TRIM("Classe") = TRIM($${paramIndex})`);
      paramIndex++;
    }

    if (params.anoPlanejamento) {
      queryParams.push(params.anoPlanejamento);
      whereConditions.push(`"Ano do Planejamento" = $${paramIndex}`);
      paramIndex++;
    }

    if (params.possuiContrato) {
      const isSim = params.possuiContrato.toUpperCase() === 'SIM';
      queryParams.push(isSim ? 'SIM' : 'NÃO');
      whereConditions.push(`"Possui Contrato" = $${paramIndex}`);
      paramIndex++;
    }

    if (params.search) {
      const searchTerm = `%${params.search.toUpperCase()}%`;
      queryParams.push(searchTerm);
      whereConditions.push(`(
        UPPER("TAG") LIKE $${paramIndex} OR 
        UPPER("Nº série (Selo INMETRO)") LIKE $${paramIndex}
      )`);
      paramIndex++;
    }

    const whereSql = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Ordenação
    const validSortColumns = ['TAG', 'Unidade', 'Regional', 'Local', 'Classe', 'Última recarga', 'Planej. Recarga', 'Data Execução Recarga'];
    const sortColumn = validSortColumns.includes(params.sortBy || '') ? params.sortBy : 'TAG';
    const sortDir = params.sortDir === 'desc' ? 'DESC' : 'ASC';
    const orderBy = `ORDER BY "${sortColumn}" ${sortDir}`;

    // Query de dados (sem paginação inicial se houver filtro de status)
    // Como o status é calculado, precisamos buscar todos os registros que correspondem aos filtros,
    // calcular o status, filtrar por status, e depois paginar
    const rowsSql = `
      SELECT 
        id,
        "Ano do Planejamento",
        "TAG",
        "Unidade",
        "Local",
        "Regional",
        "Classe",
        "Massa/Volume (kg/L)",
        "TAG de Controle Mensal",
        "Data Tagueamento",
        "Lote Contrato",
        "Possui Contrato",
        "Nº série (Selo INMETRO)",
        "Última recarga",
        "Planej. Recarga",
        "Data Execução Recarga"
      FROM spci_planilha
      ${whereSql}
      ${orderBy}
    `;

    // Executa query - se não houver filtros, executa sem parâmetros
    console.log(`[SPCI List] Executando query:`, { 
      sql: rowsSql,
      params: queryParams,
      paramsCount: queryParams.length,
      whereConditions: whereConditions,
      whereSql: whereSql
    });
    
    let rows: any[];
    try {
      if (queryParams.length > 0) {
        // Usa template string com parâmetros para garantir que funcione corretamente
        // O Prisma $queryRawUnsafe aceita parâmetros posicionais ($1, $2, etc.)
        rows = await prisma.$queryRawUnsafe<any[]>(rowsSql, ...queryParams);
        console.log(`[SPCI List] Query executada com ${queryParams.length} parâmetros:`, {
          params: queryParams,
          rowsReturned: rows.length
        });
      } else {
        // Se não há parâmetros, executa query direta
        rows = await prisma.$queryRawUnsafe<any[]>(rowsSql);
        console.log(`[SPCI List] Query executada sem parâmetros, ${rows.length} registros retornados`);
      }
    } catch (queryError: any) {
      console.error(`[SPCI List] Erro na query:`, {
        error: queryError?.message,
        stack: queryError?.stack,
        sql: rowsSql,
        params: queryParams,
        paramCount: queryParams.length
      });
      throw queryError;
    }

    console.log(`[SPCI List] Query executada. Registros encontrados: ${rows.length}`);
    if (rows.length > 0) {
      console.log(`[SPCI List] Primeiro registro exemplo:`, {
        id: rows[0].id,
        regional: rows[0].Regional,
        tag: rows[0].TAG,
        unidade: rows[0].Unidade,
      });
    } else {
      console.log(`[SPCI List] Nenhum registro encontrado com os filtros aplicados`);
      console.log(`[SPCI List] Parâmetros usados:`, {
        regional: params.regional,
        unidade: params.unidade,
        status: params.status,
        whereSql: whereSql,
        queryParams: queryParams,
      });
    }

    // Calcula status e data limite para cada registro
    // Converte BigInt para Number/String para evitar erro de serialização
    const rowsWithStatus = rows.map((row: any) => {
      // Regra: status deve considerar a recarga mais recente registrada.
      // Se houver "Data Execução Recarga", ela prevalece sobre "Última recarga".
      const dataBaseStatus = row['Data Execução Recarga'] || row['Última recarga'];
      const calculo = calcularStatus(dataBaseStatus);
      const rowConverted = convertBigIntToNumber(row);
      return {
        ...rowConverted,
        // Campos calculados (nunca vêm do banco)
        status: calculo.status,
        dataLimiteRecarga: calculo.dataLimite ? formatDateBR(calculo.dataLimite) : null,
        diasRestantes: calculo.diasRestantes,
        // Campos calculados de mês
        mesPlanejRecarga: row['Planej. Recarga'] ? getMesFromDate(row['Planej. Recarga']) : null,
        mesExecRecarga: row['Data Execução Recarga'] ? getMesFromDate(row['Data Execução Recarga']) : null,
      };
    });

    // Filtra por status calculado (se fornecido)
    let filteredRows = rowsWithStatus;
    if (params.status) {
      filteredRows = rowsWithStatus.filter((row: any) => row.status === params.status);
    }

    // Aplica ordenação novamente após calcular status (caso ordenação seja por status)
    if (params.sortBy === 'status' || params.sortBy === 'dataLimiteRecarga') {
      filteredRows.sort((a: any, b: any) => {
        let aVal: any, bVal: any;
        if (params.sortBy === 'status') {
          const order = ['OK', 'A VENCER', 'VENCIDO'];
          aVal = order.indexOf(a.status);
          bVal = order.indexOf(b.status);
        } else {
          aVal = a.dataLimiteRecarga || '';
          bVal = b.dataLimiteRecarga || '';
        }
        if (params.sortDir === 'desc') {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      });
    }

    // Paginação após filtrar por status
    const limit = params.pageSize!;
    const offset = (params.page! - 1) * limit;
    const totalCount = filteredRows.length;
    const pageCount = Math.max(1, Math.ceil(totalCount / limit));
    const paginatedRows = filteredRows.slice(offset, offset + limit);

    console.log(`[SPCI List] Resposta final:`, {
      totalCount,
      pageCount,
      rowsCount: paginatedRows.length,
      page: params.page,
      pageSize: limit,
    });

    const response = {
      ok: true,
      page: params.page,
      pageSize: limit,
      totalCount,
      pageCount,
      rows: paginatedRows,
    };

    console.log(`[SPCI List] Enviando resposta:`, {
      ok: response.ok,
      totalCount: response.totalCount,
      rowsCount: response.rows.length,
      firstRowId: response.rows[0]?.id || null,
      firstRowRegional: response.rows[0]?.Regional || null,
      hasRows: response.rows.length > 0,
    });

    // Garante que a resposta seja serializável (sem BigInt)
    const serializableResponse = {
      ...response,
      rows: response.rows.map((row: any) => convertBigIntToNumber(row)),
    };

    return NextResponse.json(serializableResponse);
  } catch (error: any) {
    console.error('[SPCI List] Erro completo:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: error?.message || 'Erro ao buscar extintores',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// Helper para extrair mês de uma data no formato dd/mm/yyyy
function getMesFromDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = parseDateBR(dateStr);
  if (!date) return null;
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return meses[date.getMonth()] || null;
}
