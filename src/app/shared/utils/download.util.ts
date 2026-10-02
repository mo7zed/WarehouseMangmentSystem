/** RFC 4180 quoting, UTF-8 BOM for Arabic, and spreadsheet formula neutralization. */
export function csvCell(value: unknown): string {
 let text = String(value ?? '');
 if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
 return '"' + text.replace(/"/g, '""') + '"';
}
export function createCsv(rows: unknown[][]): string {
 return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
/** A genuine Excel 2003 XML workbook. Strings are data, never formulas. */
export function createExcelXml(rows: unknown[][]): string {
 const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));
 const table = rows.map(row => '<Row>' + row.map(value => {
  const type = typeof value === 'number' && Number.isFinite(value) ? 'Number' : 'String';
  return `<Cell><Data ss:Type="${type}">${escape(value)}</Data></Cell>`;
 }).join('') + '</Row>').join('');
 return '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
  '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
  '<Worksheet ss:Name="Report"><Table>' + table + '</Table></Worksheet></Workbook>';
}
export function downloadFile(content: string, filename: string, mimeType: string): void {
 const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
 const link = document.createElement('a');
 link.href = url; link.download = filename; link.click();
 setTimeout(() => URL.revokeObjectURL(url), 1000);
}
