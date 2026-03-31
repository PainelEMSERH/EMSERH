/**
 * JOIN CPF entre stg_alterdata_v2 e ordem_servico.
 * - Só dígitos; vazio → NULL (não casa).
 * - Mais de 11 caracteres: últimos 11.
 * - Até 11: lpad com '0' à esquerda (CPF 10 dígitos no Excel / sem zero inicial).
 */

export function sqlCpfJoinKey(columnRef: string): string {
  const d = `regexp_replace(TRIM(COALESCE(${columnRef}, '')), '[^0-9]', '', 'g')`;
  return `(
    CASE
      WHEN ${d} = '' THEN NULL::text
      WHEN length(${d}) > 11 THEN right(${d}, 11)
      ELSE lpad(${d}, 11, '0')
    END
  )`;
}

export function sqlOrdemServicoJoinOn(aCpf = 'a.cpf', osCpf = 'os.colaborador_cpf'): string {
  const ka = sqlCpfJoinKey(aCpf);
  const ko = sqlCpfJoinKey(osCpf);
  return `${ka} IS NOT NULL AND ${ka} = ${ko}`;
}
