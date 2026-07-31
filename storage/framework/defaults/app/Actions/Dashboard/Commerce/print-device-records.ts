import {
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

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

function printDeviceTimestamp(input: unknown, source: string): number {
  if (input === 0 || input === '0')
    return 0
  return new Date(commerceTimestamp(input, source, 'last_ping')).getTime()
}

export function normalizePrintDeviceRecord(record: any): PrintDeviceRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'PrintDevice')
  const source = `PrintDevice ${id}`
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    macAddress: commerceRequiredString(
      commerceValue(record, 'mac_address', 'macAddress'),
      source,
      'mac_address',
    ),
    location: commerceRequiredString(commerceValue(record, 'location'), source, 'location'),
    terminal: commerceRequiredString(commerceValue(record, 'terminal'), source, 'terminal'),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', [
      'online',
      'offline',
      'warning',
    ]),
    lastPing: printDeviceTimestamp(commerceValue(record, 'last_ping', 'lastPing'), source),
    printCount: commerceNumber(
      commerceValue(record, 'print_count', 'printCount'),
      source,
      'print_count',
      { min: 0, integer: true },
    ),
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
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
