export interface PrintLogRecord {
  id: string
  printer: string
  document: string
  timestamp: string
  status: string
  sizeKb: number
  pages: number
  durationSeconds: number
  metadata: string
  printDeviceId: string
  createdAt: string
}

export interface PrintLogSummary {
  total: number
  successful: number
  failed: number
  warnings: number
  successRate: number
  totalPages: number
  averagePages: number
  averageSuccessfulDuration: number
}

function value(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== null && result !== undefined)
      return result
  }
  return undefined
}

function text(input: unknown): string {
  return input === null || input === undefined ? '' : String(input)
}

function number(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) ? result : 0
}

export function printLogTimestamp(input: unknown): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input))
      return 0
    return input <= 2147483647 ? input * 1000 : input
  }
  const raw = text(input).trim()
  if (!raw)
    return 0
  if (/^\d{10}$/.test(raw))
    return Number(raw) * 1000
  const parsed = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizePrintLogRecord(record: any): PrintLogRecord {
  return {
    id: text(value(record, 'id', 'uuid')),
    printer: text(value(record, 'printer')),
    document: text(value(record, 'document')),
    timestamp: text(value(record, 'timestamp')),
    status: text(value(record, 'status')).toLowerCase(),
    sizeKb: number(value(record, 'size')),
    pages: number(value(record, 'pages')),
    durationSeconds: number(value(record, 'duration')),
    metadata: text(value(record, 'metadata')),
    printDeviceId: text(value(record, 'print_device_id', 'printDeviceId')),
    createdAt: text(value(record, 'created_at', 'createdAt')),
  }
}

export function summarizePrintLogs(records: PrintLogRecord[]): PrintLogSummary {
  const successful = records.filter(record => record.status === 'success')
  const totalPages = records.reduce((total, record) => total + record.pages, 0)
  const successfulDuration = successful.reduce((total, record) => total + record.durationSeconds, 0)
  return {
    total: records.length,
    successful: successful.length,
    failed: records.filter(record => record.status === 'failed').length,
    warnings: records.filter(record => record.status === 'warning').length,
    successRate: records.length ? Math.round((successful.length / records.length) * 1000) / 10 : 0,
    totalPages,
    averagePages: records.length ? Math.round((totalPages / records.length) * 10) / 10 : 0,
    averageSuccessfulDuration: successful.length
      ? Math.round((successfulDuration / successful.length) * 10) / 10
      : 0,
  }
}

function csvCell(input: unknown): string {
  const raw = text(input)
  return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw
}

export function printLogsToCsv(records: PrintLogRecord[]): string {
  const rows: unknown[][] = [
    ['ID', 'Printer', 'Document', 'Timestamp', 'Status', 'Size KB', 'Pages', 'Duration seconds', 'Print device ID'],
    ...records.map(record => [
      record.id,
      record.printer,
      record.document,
      record.timestamp,
      record.status,
      record.sizeKb,
      record.pages,
      record.durationSeconds,
      record.printDeviceId,
    ]),
  ]
  return rows.map(row => row.map(csvCell).join(',')).join('\n')
}
