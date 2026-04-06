import ExcelJS from 'exceljs';

function pickWorksheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
  const byName =
    wb.getWorksheet('RIAT') ||
    wb.getWorksheet('Anexo III') ||
    wb.getWorksheet('Ficha RIAT') ||
    wb.getWorksheet('Planilha1');
  if (byName) return byName;
  const first = wb.worksheets[0];
  if (!first) throw new Error('O modelo RIAT não contém abas.');
  return first;
}

export async function fillRiatTemplateFromFile(
  templatePath: string,
  cellMap: Record<string, string>,
  values: Record<string, string>,
  catCell: string,
  numeroCAT: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = pickWorksheet(wb);

  for (const [cellRef, fieldKey] of Object.entries(cellMap)) {
    const v = values[fieldKey] ?? '';
    ws.getCell(cellRef).value = v === '' ? null : v;
  }

  const cat = String(numeroCAT ?? '').trim();
  ws.getCell(catCell).value = cat || null;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
