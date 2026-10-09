function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Spreadsheet formula injection guard (text cells only).
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** UTF-8 with BOM so Excel opens it correctly. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(cell).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}