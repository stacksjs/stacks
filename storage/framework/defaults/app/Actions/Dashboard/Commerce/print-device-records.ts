export type PrintDeviceStatus = 'online' | 'offline' | 'warning'

export interface PrintDeviceRecord {
  id: string
  name: string
  macAddress: string
  location: string
  terminal: string
  status: PrintDeviceStatus
  lastPing: number
  printCount: number
  createdAt: string
}
export interface PrintDeviceSummary {
  total: number
  online: number
  offline: number
  warning: number
  locations: number
  totalPrints: number
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

function timestamp(input: unknown): number {
  const numeric = number(input)
  if (numeric > 0)
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric

  const source = text(input)
  if (!source)
    return 0
  const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(source)
    ? `${source.replace(' ', 'T')}Z`
    : source
  const parsed = Date.parse(normalized)
  return Number.isNaN(parsed) ? 0 : parsed
}

function status(input: unknown): PrintDeviceStatus {
  const result = text(input).toLowerCase()
  return result === 'online' || result === 'warning' ? result : 'offline'
}

export function normalizePrintDeviceRecord(record: any): PrintDeviceRecord {
  return {
    id: text(value(record, 'id', 'uuid')),
    name: text(value(record, 'name')),
    macAddress: text(value(record, 'mac_address', 'macAddress')),
    location: text(value(record, 'location')),
    terminal: text(value(record, 'terminal')),
    status: status(value(record, 'status')),
    lastPing: timestamp(value(record, 'last_ping', 'lastPing')),
    printCount: Math.max(0, number(value(record, 'print_count', 'printCount'))),
    createdAt: text(value(record, 'created_at', 'createdAt')),
  }
}

export function summarizePrintDevices(records: PrintDeviceRecord[]): PrintDeviceSummary {
  return {
    total: records.length,
    online: records.filter(record => record.status === 'online').length,
    offline: records.filter(record => record.status === 'offline').length,
    warning: records.filter(record => record.status === 'warning').length,
    locations: new Set(records.map(record => record.location).filter(Boolean)).size,
    totalPrints: records.reduce((sum, record) => sum + record.printCount, 0),
  }
}
