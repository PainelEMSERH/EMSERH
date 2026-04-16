export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';
import { findBestUnitMatch } from '@/lib/unitMatcher';
import { findBestFunctionMatch } from '@/lib/functionMatcher';

/**
 * Calcula a meta de EPIs obrigatórios por regional
 * Meta = soma de todos os EPIs obrigatórios dos colaboradores ativos da regional
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const unidade = url.searchParams.get('unidade') || '';

    // Busca colaboradores ativos da regional/unidade
    const wh: string[] = [];
    const regTrim = regional.trim();
    const uniTrim = unidade.trim();

    // Verifica se stg_unid_reg existe
    const hasUnidReg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useJoin = hasUnidReg?.[0]?.exists;

    if (regTrim && useJoin) {
      wh.push(`(UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}'))
      ))`);
    }
    
    if (uniTrim) {
      if (useJoin) {
        wh.push(`(UPPER(TRIM(COALESCE(u.nmdepartamento, a.unidade_hospitalar, ''))) = UPPER(TRIM('${uniTrim.replace(/'/g, "''")}')) OR UPPER(TRIM(a.unidade_hospitalar)) = UPPER(TRIM('${uniTrim.replace(/'/g, "''")}')))`);
      } else {
        wh.push(`UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${uniTrim.replace(/'/g, "''")}'))`);
      }
    }

    // Só considera cadastro ATIVO: demissão em branco (não conta pessoa já demitida)
    wh.push(`(a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '')`);

    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

    // Busca TODOS os colaboradores (sem GROUP BY - mantém duplicatas se CPF aparecer 2x)
    const sql = useJoin ? `
      SELECT 
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(a.unidade_hospitalar, '') AS unidade_hospitalar
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${whereSql}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    ` : `
      SELECT 
        COALESCE(a.cpf, '') AS cpf,
        COALESCE(a.funcao, '') AS funcao,
        COALESCE(a.unidade_hospitalar, '') AS unidade_hospitalar
      FROM stg_alterdata_v2 a
      ${whereSql}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `;

    let colaboradores = await prisma.$queryRawUnsafe<any[]>(sql);
    console.log(`[Meta API] Colaboradores encontrados: ${colaboradores.length} (pode ter CPFs duplicados se demitido e voltou em 2026)`);
    
    // Filtra colaboradores marcados como "fora da meta" (DEMITIDO_2026_SEM_EPI, DEMITIDO_2025_SEM_EPI, EXCLUIDO_META)
    try {
      const cpfsList = colaboradores.map(c => String(c.cpf || '').replace(/\D/g, '').slice(-11)).filter(c => c.length === 11);
      if (cpfsList.length > 0) {
        const situacoesResult = await prisma.$queryRawUnsafe<any[]>(`
          SELECT cpf, situacao
          FROM colaborador_situacao_meta
          WHERE cpf = ANY($1::text[])
            AND situacao IN ('DEMITIDO_2026_SEM_EPI', 'DEMITIDO_2025_SEM_EPI', 'EXCLUIDO_META')
        `, cpfsList);
        
        const cpfsForaMeta = new Set(situacoesResult.map(r => r.cpf));
        if (cpfsForaMeta.size > 0) {
          colaboradores = colaboradores.filter(c => {
            const cpfLimpo = String(c.cpf || '').replace(/\D/g, '').slice(-11);
            return !cpfsForaMeta.has(cpfLimpo);
          });
          console.log(`[Meta API] Removidos ${cpfsForaMeta.size} colaboradores marcados como "fora da meta"`);
        }
      }
    } catch (e) {
      console.warn('[Meta API] Erro ao filtrar colaboradores fora da meta:', e);
      // Continua mesmo com erro
    }

    // Busca kits de stg_epi_map (mesma fonte do botão "Entregar") - COM PCG
    let kitRows: any[] = [];
    try {
      kitRows = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COALESCE(pcg::text, '') AS pcg,
          COALESCE(alterdata_funcao::text, '') AS funcao,
          COALESCE(unidade_hospitalar::text, '') AS site,
          COALESCE(unidade_hospitalar::text, '') AS unidade_hosp,
          COALESCE(epi_item::text, '') AS item,
          COALESCE(quantidade::numeric, 1) AS qtd
        FROM stg_epi_map
      `);
      console.log(`[Meta API] Kits encontrados em stg_epi_map: ${kitRows.length}`);
    } catch (mapError: any) {
      console.error('[Meta API] Erro ao buscar de stg_epi_map:', mapError?.message || mapError);
      return NextResponse.json({
        ok: false,
        error: `Erro ao buscar kits: ${String(mapError)}`,
        meta: 0,
      });
    }

    // Funções auxiliares (mesmas do /api/entregas/kit)
    function normKey(s: any): string {
      return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    }
    
    function normFuncKey(s: any): string {
      const raw = (s ?? '').toString();
      const cleaned = raw.replace(/\(A\)/gi, '').replace(/\s+/g, ' ');
      return normKey(cleaned);
    }
    
    function normUnidKey(s: any): string {
      const raw = (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const withoutStops = raw.replace(/\b(hospital|hosp|de|da|das|do|dos)\b/g, ' ');
      return withoutStops.replace(/[^a-z0-9]/gi, '');
    }

    // ===== REGRA NOVA (2026): Setor ainda é desconhecido no previsto/meta =====
    // O `stg_epi_map.unidade_hospitalar` agora representa SETOR. Então não dá para
    // usar a unidade do Alterdata para escolher um setor automaticamente.
    // Para não “quebrar” a meta, o previsto deve usar o kit-base:
    // - pcg = PCG UNIVERSAL
    // - setor/unidade_hospitalar = "SEM SETOR ESPECÍFICO"
    const isSemSetorBase = (s: any) => {
      const v = String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
      return v.includes('SEM SETOR');
    };
    const isPcgUniversal = (s: any) => {
      const v = String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
      return v.includes('PCG UNIVERSAL');
    };

    // Base de funções do mapa (ALTERDATA + NORMALIZADO)
    const allFunctionsList = Array.from(
      new Set(
        kitRows
          .flatMap((r: any) => [r.funcao, r.funcao_norm, r.funcao_normalizada])
          .map((x: any) => String(x || '').trim())
          .filter(Boolean),
      ),
    );

    // Cache por função (previsto base), soma de itens obrigatórios
    const kitCache = new Map<string, number>(); // chave: finalFuncKey -> soma de itens obrigatórios
    let totalMeta = 0;

    // Para cada colaborador (mesmo CPF pode aparecer 2x se demitido e voltou em 2026)
    for (const colab of colaboradores) {
      const funcao = String(colab.funcao || '').trim();
      
      if (!funcao) continue;
      
      const funcKey = normFuncKey(funcao);
      
      // Resolve a melhor função usando Matcher Inteligente (Alias, Motorista, etc)
      let finalFuncKey = funcKey;
      if (allFunctionsList.length > 0) {
        const matchedFunc = findBestFunctionMatch(funcao, allFunctionsList);
        if (matchedFunc) {
          finalFuncKey = normFuncKey(matchedFunc);
        }
      }
      
      // Busca soma do kit (usa cache)
      let somaKit = 0;
      if (kitCache.has(finalFuncKey)) {
        somaKit = kitCache.get(finalFuncKey)!;
      } else {
        // Kit-base (setor desconhecido):
        // - prioridade: PCG UNIVERSAL + "SEM SETOR ESPECÍFICO"
        // - fallback: PCG UNIVERSAL em QUALQUER setor (pega o maior por item)
        const semSetorRows: any[] = [];
        const anySetorRows: any[] = [];

        for (const r of kitRows) {
          const rFuncKey = normFuncKey(r.funcao_norm || r.funcao || '');
          const rFuncAlt = normFuncKey(r.funcao || '');
          if (rFuncKey !== finalFuncKey && rFuncAlt !== finalFuncKey) continue;

          const item = String(r.item || '').trim();
          if (!item || item.toUpperCase() === 'SEM EPI' || !isEpiObrigatorio(item)) continue;
          if (!isPcgUniversal(r.pcg)) continue;

          const setor = r.unidade_hosp || r.site || r.unidade_hospitalar;
          if (isSemSetorBase(setor)) semSetorRows.push(r);
          anySetorRows.push(r);
        }

        const baseRows = semSetorRows.length > 0 ? semSetorRows : anySetorRows;
        const byItem = new Map<string, number>();
        for (const r of baseRows) {
          const item = String(r.item || '').trim();
          const qtd = Number(r.qtd || 1) || 1;
          if (!item || qtd <= 0) continue;
          const itemKey = normKey(item);
          const existing = byItem.get(itemKey);
          if (!existing || qtd > existing) byItem.set(itemKey, qtd);
        }

        somaKit = Array.from(byItem.values()).reduce((acc, qtd) => acc + qtd, 0);
        kitCache.set(finalFuncKey, somaKit);
      }
      
      // Adiciona à meta (conta cada linha, mesmo se CPF duplicado)
      totalMeta += somaKit;
    }
    
    console.log(`[Meta API] Meta calculada: ${totalMeta} itens para ${colaboradores.length} colaboradores`);

    return NextResponse.json({
      ok: true,
      meta: totalMeta,
      colaboradores: colaboradores.length,
      regional: regTrim || null,
      unidade: uniTrim || null,
    });
  } catch (e: any) {
    console.error('Erro ao calcular meta:', e);
    return NextResponse.json({
      ok: false,
      error: String(e?.message || e),
      meta: 0,
    });
  }
}
