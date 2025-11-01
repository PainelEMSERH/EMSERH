import { NextResponse } from 'next/server';

export async function GET() {
  const header = ['ALTERDATA','ITEM DO EPI','QTD','NOME SITE'].join(',');
  const body = [
    'ENFERMEIRO, Máscara N95, 1, Enfermeiro',
    'ENFERMEIRO, Luva nitrílica, 1, Enfermeiro',
    'ENFERMEIRO UTI, Máscara N95, 1, Enfermeiro UTI'
  ].join('\n');
  const csv = header + '\n' + body + '\n';
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="template_stg_epi_map.csv"'
    }
  });
}
