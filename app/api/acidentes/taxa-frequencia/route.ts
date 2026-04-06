export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { getTaxaFrequenciaRegistros } from '@/lib/acidentes/taxaFrequenciaCore';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const ano = parseInt(url.searchParams.get('ano') || String(new Date().getFullYear()), 10);

    const { registros, fonteAtivos, anosComDados } = await getTaxaFrequenciaRegistros(ano, regional);

    return NextResponse.json({
      ok: true,
      registros,
      fonteAtivos,
      anosComDados,
    });
  } catch (e: any) {
    console.error('[acidentes/taxa-frequencia][GET] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      ano,
      mes,
      numeroAcidentes,
      horasHomemTrabalhadas,
    }: {
      ano: number;
      mes: number;
      numeroAcidentes: number;
      horasHomemTrabalhadas: number;
    } = body;

    if (!ano || !mes) {
      return NextResponse.json(
        { ok: false, error: 'Ano e mês são obrigatórios' },
        { status: 400 },
      );
    }
    if (numeroAcidentes == null || numeroAcidentes < 0) {
      return NextResponse.json(
        { ok: false, error: 'Número de acidentes inválido' },
        { status: 400 },
      );
    }
    if (!horasHomemTrabalhadas || horasHomemTrabalhadas <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Total de horas-homem trabalhadas deve ser maior que zero' },
        { status: 400 },
      );
    }

    const tf = (numeroAcidentes * 1_000_000) / horasHomemTrabalhadas;

    const registro = await prisma.taxaFrequenciaAcidente.upsert({
      where: {
        ano_mes: {
          ano,
          mes,
        },
      },
      update: {
        numeroAcidentes,
        horasHomemTrabalhadas,
        taxaFrequencia: tf,
      },
      create: {
        ano,
        mes,
        numeroAcidentes,
        horasHomemTrabalhadas,
        taxaFrequencia: tf,
      },
    });

    return NextResponse.json({ ok: true, registro });
  } catch (e: any) {
    console.error('[acidentes/taxa-frequencia][POST] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 },
    );
  }
}
