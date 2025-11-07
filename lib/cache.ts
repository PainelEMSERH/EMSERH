
// lib/cache.ts
import { revalidateTag as _revalidateTag } from "next/cache";

export const ALTERDATA_TAG = "alterdata";

export function revalidateAlterdata() {
  // Centraliza a tag de invalidação
  // Chame isso após import/upload concluído
  // Ex.: revalidateAlterdata();
  // Em rotas server action/route handler: apenas invoque.
  _revalidateTag(ALTERDATA_TAG);
}
