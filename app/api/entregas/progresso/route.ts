export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';

/**
 * Calcula o progresso de entregas por mês
 * Retorna quantos EPIs obrigatórios foram entregues em cada mês
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const unidade = url.searchParams.get('unidade') || '';
    const ano = parseInt(url.searchParams.get('ano') || '2026', 10);

    // Inicializa objeto com todos os meses zerados
    const meses: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      meses[String(m).padStart(2, '0')] = 0;
    }

    // Busca CPFs dos colaboradores da regional/unidade
    const wh: string[] = [];
    const regTrim = regional.trim();
    const uniTrim = unidade.trim();

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
    const DEMISSAO_WHERE = `(a.demissao IS NULL OR a.demissao = '' OR TRIM(a.demissao) = '')`;
    wh.push(DEMISSAO_WHERE);

    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

    const sql = useJoin ? `
      SELECT DISTINCT COALESCE(a.cpf, '') AS cpf
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      ${whereSql}
    ` : `
      SELECT DISTINCT COALESCE(a.cpf, '') AS cpf
      FROM stg_alterdata_v2 a
      ${whereSql}
    `;

    let colaboradores = await prisma.$queryRawUnsafe<any[]>(sql);
    // CPF sempre 11 dígitos (com zero à esquerda se precisar) para bater com epi_entregas
    const norm = (s: string) => String(s || '').replace(/\D/g, '').padStart(11, '0').slice(-11);
    let cpfsSet = new Set(
      colaboradores.map((c: any) => norm(String(c.cpf || ''))).filter((x) => x.length === 11)
    );

    // Fallback: se a query por regional retornou 0 CPFs, busca por unidades (igual ao Diagnóstico)
    if (cpfsSet.size === 0 && useJoin && regTrim) {
      try {
        const unidadesSql = `
          SELECT DISTINCT COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade
          FROM stg_alterdata_v2 a
          LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
          WHERE (UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}'))
                 OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
                   SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${regTrim.replace(/'/g, "''")}'))
                 ))
            AND ${DEMISSAO_WHERE}
          ORDER BY unidade
        `;
        const unidadesRows = await prisma.$queryRawUnsafe<{ unidade: string }[]>(unidadesSql);
        const unidadesList = (unidadesRows || []).map((r) => String(r.unidade || '').trim()).filter(Boolean);
        for (const unidadeNome of unidadesList) {
          const cpfsUnidSql = `
            SELECT DISTINCT COALESCE(a.cpf, '') AS cpf
            FROM stg_alterdata_v2 a
            LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
            WHERE (UPPER(TRIM(COALESCE(u.nmdepartamento, a.unidade_hospitalar, ''))) = UPPER(TRIM('${unidadeNome.replace(/'/g, "''")}')) OR UPPER(TRIM(a.unidade_hospitalar)) = UPPER(TRIM('${unidadeNome.replace(/'/g, "''")}')))
              AND ${DEMISSAO_WHERE}
          `;
          const cpfsUnid = await prisma.$queryRawUnsafe<any[]>(cpfsUnidSql).catch(() => []);
          for (const c of cpfsUnid || []) {
            const n = norm(String(c.cpf || ''));
            if (n.length === 11) cpfsSet.add(n);
          }
        }
      } catch (_) {}
    }

    if (cpfsSet.size === 0) {
      return NextResponse.json({
        ok: true,
        meses,
        total: 0,
        ano,
      });
    }

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS epi_entregas (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        cpf TEXT NOT NULL,
        item TEXT NOT NULL,
        qty_required INT DEFAULT 1,
        qty_delivered INT DEFAULT 0,
        deliveries JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(cpf, item)
      );
    `);

    // Mesma estratégia do Diagnóstico: carrega TODAS as entregas e filtra em memória por CPF.
    // Assim o card fica igual ao total do Diagnóstico (Total Realizada).
    const todasEntregas = await prisma.$queryRawUnsafe<any[]>(`
      SELECT cpf, item, deliveries, qty_delivered,
             updated_at::text AS updated_at, created_at::text AS created_at
      FROM epi_entregas
    `).catch(() => []);

    const entregas = todasEntregas.filter((e: any) => {
      const eCpf = norm(String(e.cpf || ''));
      return eCpf.length === 11 && cpfsSet.has(eCpf);
    });

    // Parseia deliveries (pode vir como string JSON do banco)
    const parseDeliveries = (val: any): Array<{ date?: string; qty?: number; quantity?: number }> => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim()) {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const dateToYMD = (d: any): string | null => {
      if (!d) return null;
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.substring(0, 10);
      try {
        const date = d instanceof Date ? d : new Date(d);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
      } catch {}
      return null;
    };

    // Processa entregas por mês (apenas EPIs obrigatórios) — mesma lógica do Diagnóstico
    for (const entrega of entregas) {
      const item = String(entrega.item || '').trim();
      if (!item || !isEpiObrigatorio(item)) continue;

      const deliveries = parseDeliveries(entrega.deliveries);
      let contadoNoArray = 0;

      for (const del of deliveries) {
        const dateVal = del.date ?? (del as any).Date;
        const dateStr = dateToYMD(dateVal);
        const q = Number(del.qty ?? del.quantity ?? 0);
        if (!dateStr || q <= 0) continue;
        const [year, month] = dateStr.split('-');
        if (year && month && parseInt(year, 10) === ano) {
          const mesKey = month.padStart(2, '0');
          meses[mesKey] = (meses[mesKey] || 0) + q;
          contadoNoArray += q;
        }
      }

      const qtyDelivered = Number(entrega.qty_delivered || 0);
      if (qtyDelivered > 0 && contadoNoArray < qtyDelivered) {
        const falta = qtyDelivered - contadoNoArray;
        const dtStr = (entrega.updated_at || entrega.created_at || '').toString().substring(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(dtStr)) {
          const [y, m] = dtStr.split('-');
          if (parseInt(y, 10) === ano) {
            const mesKey = (m || '').padStart(2, '0');
            meses[mesKey] = (meses[mesKey] || 0) + falta;
          }
        }
      }
    }

    const total = Object.values(meses).reduce((acc, val) => acc + val, 0);

    const debug = url.searchParams.get('debug') === '1' || url.searchParams.get('debug') === 'true';
    const body: Record<string, unknown> = {
      ok: true,
      meses,
      total,
      ano,
    };
    if (debug) {
      body._debug = {
        cpfsCount: cpfsSet.size,
        todasEntregasCount: todasEntregas.length,
        entregasFiltradasCount: entregas.length,
      };
    }
    return NextResponse.json(body);
  } catch (e: any) {
    console.error('Erro ao calcular progresso:', e);
    return NextResponse.json({
      ok: false,
      error: String(e?.message || e),
      meses: {},
      total: 0,
    });
  }
}
