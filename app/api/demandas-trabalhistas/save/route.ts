import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureDemandasTrabalhistasTables, toDateISO, toNullableInt, normText } from '@/lib/demandas-trabalhistas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await ensureDemandasTrabalhistasTables();
    const body = await req.json();

    const id = body.id as number | null | undefined;
    const numeroSei = normText(body.numeroSei);
    const demandante = normText(body.demandante);
    const tipoDemanda = normText(body.tipoDemanda);
    const origem = normText(body.origem);
    const unidade = normText(body.unidade);
    const regional = normText(body.regional);
    const responsavel = normText(body.responsavel);
    const status = normText(body.status);
    const statusFinal = normText(body.statusFinal);
    const destino = normText(body.destino);
    const observacoes = normText(body.observacoes);
    const prazoDias = toNullableInt(body.prazoDias);
    const tempoRespostaDias = toNullableInt(body.tempoRespostaDias);
    const dataChegadaISO = toDateISO(body.dataChegada);
    const dataLimiteISO = toDateISO(body.dataLimite);
    const dataConclusaoISO = toDateISO(body.dataConclusao);

    const anoChegada =
      dataChegadaISO && /^\d{4}-\d{2}-\d{2}$/.test(dataChegadaISO)
        ? Number(dataChegadaISO.slice(0, 4))
        : null;

    const monthShortPtFromISO = (iso: string | null): string | null => {
      if (!iso) return null;
      const d = new Date(`${iso}T00:00:00`);
      if (Number.isNaN(d.getTime())) return null;
      const raw = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
      return raw.replace('.', '').toUpperCase();
    };

    const mesChegada = dataChegadaISO ? monthShortPtFromISO(dataChegadaISO) : null;
    const mesConclusao =
      normText(body.mesConclusao) || (dataConclusaoISO ? monthShortPtFromISO(dataConclusaoISO) : null);

    if (!numeroSei && !demandante) {
      return NextResponse.json(
        { ok: false, error: 'Informe pelo menos o Nº SEI ou o Demandante' },
        { status: 400 }
      );
    }

    if (id) {
      const query = `
        UPDATE demandas_trabalhistas SET
          numero_sei = $1,
          demandante = $2,
          tipo_demanda = $3,
          origem = $4,
          unidade = $5,
          regional = $6,
          data_chegada = $7::date,
          mes_chegada = $8,
          ano_chegada = $9,
          responsavel = $10,
          status = $11,
          prazo_dias = $12,
          data_limite = $13::date,
          data_conclusao = $14::date,
          mes_conclusao = $15,
          destino = $16,
          status_final = $17,
          tempo_resposta_dias = $18,
          observacoes = $19,
          updated_at = NOW()
        WHERE id = $20
        RETURNING *
      `;

      const rows: any[] = await prisma.$queryRawUnsafe(
        query,
        numeroSei,
        demandante,
        tipoDemanda,
        origem,
        unidade,
        regional,
        dataChegadaISO,
        mesChegada,
        anoChegada,
        responsavel,
        status,
        prazoDias,
        dataLimiteISO,
        dataConclusaoISO,
        mesConclusao,
        destino,
        statusFinal,
        tempoRespostaDias,
        observacoes,
        id
      );

      return NextResponse.json({ ok: true, row: rows[0] ?? null });
    }

    const insertQuery = `
      INSERT INTO demandas_trabalhistas (
        numero_sei,
        demandante,
        tipo_demanda,
        origem,
        unidade,
        regional,
        data_chegada,
        mes_chegada,
        ano_chegada,
        responsavel,
        status,
        prazo_dias,
        data_limite,
        data_conclusao,
        mes_conclusao,
        destino,
        status_final,
        tempo_resposta_dias,
        observacoes,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7::date, $8, $9,
        $10, $11, $12,
        $13::date, $14::date, $15,
        $16, $17, $18, $19,
        NOW()
      )
      RETURNING *
    `;

    const inserted: any[] = await prisma.$queryRawUnsafe(
      insertQuery,
      numeroSei,
      demandante,
      tipoDemanda,
      origem,
      unidade,
      regional,
      dataChegadaISO,
      mesChegada,
      anoChegada,
      responsavel,
      status,
      prazoDias,
      dataLimiteISO,
      dataConclusaoISO,
      mesConclusao,
      destino,
      statusFinal,
      tempoRespostaDias,
      observacoes
    );

    return NextResponse.json({ ok: true, row: inserted[0] ?? null });
  } catch (e: any) {
    console.error('[demandas-trabalhistas/save] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

