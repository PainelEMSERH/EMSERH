
// app/api/alterdata/import/route.ts (trecho relevante a ser adicionado/após sucesso do import)
// IMPORTANTE: Se você preferir, substitua seu arquivo por uma versão que já inclui isso.

import { revalidateTag } from "next/cache";

// ... dentro do bloco try após concluir a transação e *antes* do return:
try {
  // ... (seu processamento de upload/import)

  // Invalida cache da página Alterdata (SSR + CDN)
  revalidateTag("alterdata");

  // (Opcional) se estiver usando MV:
  // await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_alterdata_flat;`);

  return NextResponse.json({ ok: true });
} catch (e) {
  // ...
}
