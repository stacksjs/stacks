import type { WaitlistProductJsonResponse } from '@stacksjs/orm'
import type { SpreadsheetWrapper } from 'ts-spreadsheets'
import { createSpreadsheet } from 'ts-spreadsheets'
import { fetchAll } from './fetch'

/**
 * Represents the structure of an exported waitlist product
 */
export interface ExportedWaitlistProduct {
  'ID': number
  'Name': string
  'Email': string
  'Phone': string
  'Party Size': number
  'Notification Preference': string
  'Source': string
  'Status': string
  'Created At': string
  'Notified At': string
  'Purchased At': string
  'Cancelled At': string
  'Notes': string
}

/**
 * Export waitlist products to a spreadsheet
 * @param format The format of the spreadsheet (default is CSV)
 * @returns Spreadsheet object ready for download or storage
 */
export async function exportWaitlist(format: 'csv' | 'excel' = 'csv'): Promise<SpreadsheetWrapper> {
  // Fetch all waitlist products
  const waitlistProducts = await fetchAll()

  // Prepare data for spreadsheet
  const spreadsheetData = prepareWaitlistForExport(waitlistProducts)

  // Create and return spreadsheet
  return createSpreadsheet(spreadsheetData, { type: format })
}

/**
 * Prepare waitlist data for spreadsheet export
 * @param waitlistProducts Array of waitlist product objects
 * @returns Spreadsheet data structure
 */
function prepareWaitlistForExport(waitlistProducts: WaitlistProductJsonResponse[]) {
  // Define headings
  const headings: (keyof ExportedWaitlistProduct)[] = [
    'ID',
    'Name',
    'Email',
    'Phone',
    'Party Size',
    'Notification Preference',
    'Source',
    'Status',
    'Created At',
    'Notified At',
    'Purchased At',
    'Cancelled At',
    'Notes',
  ]

  // Transform waitlist products into export format
  const data = waitlistProducts.map((product) => {
    return [
      product.id,
      product.name,
      product.email,
      product.phone || 'N/A',
      product.party_size,
      product.notification_preference,
      product.source,
      product.status,
      product.created_at,
      product.notified_at || 'N/A',
      product.purchased_at || 'N/A',
      product.cancelled_at || 'N/A',
      product.notes || 'N/A',
    ]
  })

  return { headings, data }
}

/**
 * Export waitlist products and automatically download
 * @param format The format of the spreadsheet (default is CSV)
 * @param filename Optional filename for the download
 * @returns Download response
 */
export async function downloadWaitlist(format: 'csv' | 'excel' = 'csv', filename?: string): Promise<Response> {
  const spreadsheet = await exportWaitlist(format)

  // Use default filename if not provided
  const defaultFilename = `waitlist_export_${new Date().toISOString().split('T')[0]}.${format}`
  return spreadsheet.download(filename || defaultFilename)
}

/**
 * Store waitlist export to disk
 * @param format The format of the spreadsheet (default is CSV)
 * @param path Optional path to store the file
 * @returns Path where the file is stored
 */
export async function storeWaitlistExport(format: 'csv' | 'excel' = 'csv', path?: string): Promise<void> {
  const spreadsheet = await exportWaitlist(format)

  // Use default path and filename if not provided
  const defaultPath = `waitlist_export_${new Date().toISOString().split('T')[0]}.${format}`

  spreadsheet.store(path || defaultPath)
}
