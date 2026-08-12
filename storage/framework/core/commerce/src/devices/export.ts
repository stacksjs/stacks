import type { ModelRow, PrintDevice } from '@stacksjs/orm'
type PrintDeviceJsonResponse = ModelRow<typeof PrintDevice>
import type { SpreadsheetWrapper } from 'ts-spreadsheets'
import { createSpreadsheet } from 'ts-spreadsheets'
import { fetchAll } from './fetch'

/**
 * Represents the structure of an exported print device
 */
export interface ExportedPrintDevice {
  'Device ID': number
  'Name': string
  'MAC Address': string
  'Location': string
  'Terminal': string
  'Status': string
  'Last Ping': string
  'Print Count': number
}

function value(device: PrintDeviceJsonResponse, camel: keyof PrintDeviceJsonResponse, snake: string = camel): unknown {
  const values = device as unknown as Record<string, unknown>
  return values[String(camel)] ?? values[snake]
}

function timestamp(value: unknown): Date {
  if (value instanceof Date)
    return value

  if (typeof value === 'number')
    return new Date(value)

  if (typeof value === 'string')
    return new Date(/^\d+$/.test(value) ? Number(value) : value)

  return new Date(Number.NaN)
}

function numberValue(device: PrintDeviceJsonResponse, camel: keyof PrintDeviceJsonResponse, snake: string = camel): number {
  const raw = value(device, camel, snake)
  if (typeof raw === 'number')
    return raw

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function stringValue(device: PrintDeviceJsonResponse, camel: keyof PrintDeviceJsonResponse, snake: string = camel): string {
  const raw = value(device, camel, snake)
  return raw == null ? '' : String(raw)
}

/**
 * Export print devices to a spreadsheet
 * @param format The format of the spreadsheet (default is CSV)
 * @returns Spreadsheet object ready for download or storage
 */
export async function exportPrintDevices(format: 'csv' | 'excel' = 'csv'): Promise<SpreadsheetWrapper> {
  // Fetch all print devices
  const devices = await fetchAll()

  // Prepare data for spreadsheet
  const spreadsheetData = prepareDevicesForExport(devices)

  // Create and return spreadsheet
  return createSpreadsheet(spreadsheetData, { type: format })
}

/**
 * Prepare print devices data for spreadsheet export
 * @param devices Array of print device objects
 * @returns Spreadsheet data structure
 */
function prepareDevicesForExport(devices: PrintDeviceJsonResponse[]) {
  // Define headings
  const headings: (keyof ExportedPrintDevice)[] = [
    'Device ID',
    'Name',
    'MAC Address',
    'Location',
    'Terminal',
    'Status',
    'Last Ping',
    'Print Count',
  ]

  // Transform devices into export format
  const data = devices.map((device) => {
    return [
      numberValue(device, 'id'),
      stringValue(device, 'name'),
      stringValue(device, 'macAddress', 'mac_address'),
      stringValue(device, 'location'),
      stringValue(device, 'terminal'),
      stringValue(device, 'status'),
      timestamp(value(device, 'lastPing', 'last_ping')).toLocaleString(),
      numberValue(device, 'printCount', 'print_count'),
    ]
  })

  return { headings, data }
}

/**
 * Export print devices and automatically download
 * @param format The format of the spreadsheet (default is CSV)
 * @param filename Optional filename for the download
 * @returns Download response
 */
export async function downloadPrintDevices(format: 'csv' | 'excel' = 'csv', filename?: string): Promise<Response> {
  const spreadsheet = await exportPrintDevices(format)

  // Use default filename if not provided
  const defaultFilename = `print_devices_export_${new Date().toISOString().split('T')[0]}.${format}`
  return spreadsheet.download(filename || defaultFilename)
}

/**
 * Store print devices export to disk
 * @param format The format of the spreadsheet (default is CSV)
 * @param path Optional path to store the file
 * @returns Path where the file is stored
 */
export async function storePrintDevicesExport(format: 'csv' | 'excel' = 'csv', path?: string): Promise<void> {
  const spreadsheet = await exportPrintDevices(format)

  // Use default path and filename if not provided
  const defaultPath = `print_devices_export_${new Date().toISOString().split('T')[0]}.${format}`

  spreadsheet.store(path || defaultPath)
}
