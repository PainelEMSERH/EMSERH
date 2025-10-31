// app/api/etl/sync/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST() {
  try {
    // Executa o SQL do ETL em runtime (espera permissões).
    // Você pode mover o conteúdo do sql/etl_from_staging.sql para uma string aqui
    // ou chamar funções Prisma equivalentes. Para simplificar, retornamos instruções.
    return NextResponse.json({
      status: 'ready',
      message: 'Execute o SQL em sql/etl_from_staging.sql no seu banco Neon (psql/neon console).',
    })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? 'ETL error' }, { status: 500 })
  }
}
