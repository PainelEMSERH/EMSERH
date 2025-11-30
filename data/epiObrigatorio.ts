
// data/epiObrigatorio.ts
// Define quais EPIs contam como OBRIGATÓRIOS para fins de meta/pendência/dashboard.
// A lista é baseada na definição do SESMT (Jonathan).

const RAW_OBRIGATORIOS = [
  'Máscara N95',
  'Luva nitrílica para proteção química e biológica',
  'Bota de PVC',
  'Avental de PVC',
  'Óculos de proteção',
  'Luva de Látex',
  'Cinto de Segurança',
  'Talabarte de Segurança',
  'Avental de chumbo ou plumbífero',
  'Óculos plumbíferos',
  'Protetores de gônadas',
  'Protetores de tireoide',
  'Máscara 6200',
];

const UPPER_SET = new Set(
  RAW_OBRIGATORIOS.map((s) =>
    s
      .toUpperCase()
      .trim(),
  ),
);

/**
 * Retorna true se o nome do EPI for considerado obrigatório
 * para fins de meta do SESMT.
 */
export function isEpiObrigatorio(nome: string | null | undefined): boolean {
  if (!nome) return false;
  const key = nome
    .toString()
    .toUpperCase()
    .trim();
  return UPPER_SET.has(key);
}

/**
 * Gera um trecho de SQL para filtrar APENAS itens obrigatórios,
 * usando comparação case-insensitive. Requer que os nomes no
 * banco venham do mesmo mapa oficial de EPIs.
 *
 * Exemplo de uso:
 *   const whereObrig = obrigatoriosWhereSql('m.epi_item');
 *   const sql = `SELECT ... FROM ... WHERE ${whereObrig}`;
 */
export function obrigatoriosWhereSql(column: string): string {
  const list = Array.from(UPPER_SET)
    .map((v) => `'${v.replace(/'/g, "''")}'`)
    .join(', ');
  return `UPPER(TRIM(${column})) IN (${list})`;
}
