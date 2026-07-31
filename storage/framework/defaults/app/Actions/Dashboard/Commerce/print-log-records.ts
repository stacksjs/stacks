import {
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export type PrintLogStatus = 'success' | 'failed' | 'warning'

export interface PrintLogRecord {
  id: string
  printer: string
  document: string
  timestamp: string
  status: PrintLogStatus
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

export function printLogTimestamp(input: unknown): number {
  return new Date(commerceTimestamp(input, 'Receipt', 'timestamp')).getTime()
}

export function normalizePrintLogRecord(
  record: any,
  printDeviceIds = new Set<string>(),
): PrintLogRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Receipt')
  const source = `Receipt ${id}`
  const printDeviceId = commerceOptionalIdentifier(
    commerceValue(record, 'print_device_id', 'printDeviceId'),
    source,
    'print_device_id',
  )
  if (printDeviceId && !printDeviceIds.has(printDeviceId))
    throw new TypeError(`${source}.print_device_id references missing PrintDevice ${printDeviceId}.`)
  return {
    id,
    printer: commerceOptionalString(commerceValue(record, 'printer'), source, 'printer'),
    document: commerceRequiredString(commerceValue(record, 'document'), source, 'document'),
    timestamp: commerceTimestamp(commerceValue(record, 'timestamp'), source, 'timestamp'),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', [
      'success',
      'failed',
      'warning',
    ]),
    sizeKb: commerceNumber(commerceValue(record, 'size'), source, 'size', { min: 0, max: 100 }),
    pages: commerceNumber(commerceValue(record, 'pages'), source, 'pages', {
      min: 0,
      max: 50,
      integer: true,
    }),
    durationSeconds: commerceNumber(commerceValue(record, 'duration'), source, 'duration', {
      min: 0,
      max: 50,
    }),
    metadata: commerceOptionalString(commerceValue(record, 'metadata'), source, 'metadata'),
    printDeviceId,
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
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
  const raw = String(input ?? '')
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
