// This is an optional example to enrich rows with `regional` from DB if you created `stg_unid_reg`.
// Rename this file to `route.ts` if you want to replace your current route.
// Otherwise, the UI derives `regional` on the client without changing the DB.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT a.*, r.regional
    FROM stg_alterdata a
    LEFT JOIN stg_unid_reg r
      ON UPPER(TRIM(translate(a.unidade, 'ÁÀÃÂÉÊÍÓÔÕÚÜÇ','AAAAEEIOOOUUC'))) =
         UPPER(TRIM(translate(r.unidade,'ÁÀÃÂÉÊÍÓÔÕÚÜÇ','AAAAEEIOOOUUC')))
    ORDER BY a."Admissão" NULLS LAST, a."Colaborador"
  `);
  return NextResponse.json({ rows });
}
