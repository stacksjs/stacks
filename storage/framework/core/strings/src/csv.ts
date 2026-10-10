export interface CsvOptions {
  /** Make textual cells safe to open in spreadsheet programs. Enabled by default. */
  spreadsheetSafe?: boolean
  /** Excel and similar programs use this to identify UTF-8. */
  bom?: boolean
}
/** RFC 4180 escaping, CRLF lines and optional UTF-8 BOM. Numeric negatives stay numeric. */
export function csvCell(value: unknown, options: CsvOptions = {}): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (options.spreadsheetSafe !== false && typeof value === 'string' && /^[\s\u0000-\u001F]*[=+@-]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[], options: CsvOptions = {}): string {
  return (options.bom ? '\uFEFF' : '') + [header, ...rows].map(row => row.map(cell => csvCell(cell, options)).join(',')).join('\r\n')
}
