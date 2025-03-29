import type { WaitlistRestaurantJsonResponse } from '@stacksjs/orm'
import type { SpreadsheetWrapper } from 'ts-spreadsheets'
import { createSpreadsheet } from 'ts-spreadsheets'
import { fetchAll } from './fetch'

/**
 * Represents the structure of an exported restaurant waitlist entry
 */
export interface ExportedRestaurantWaitlist {
  'ID': number
  'Name': string
  'Phone': string
  'Party Size': number
  'Table Preference': string
  'Status': string
  'Quoted Wait Time': number
  'Actual Wait Time': number
  'Check In Time': string
  'Created At': string
  'Notes': string
}

/**
 * Export restaurant waitlist entries to a spreadsheet
 * @param format The format of the spreadsheet (default is CSV)
 * @returns Spreadsheet object ready for download or storage
 */
export async function exportRestaurantWaitlist(format: 'csv' | 'excel' = 'csv'): Promise<SpreadsheetWrapper> {
  // Fetch all restaurant waitlist entries
  const waitlistEntries = await fetchAll()

  // Prepare data for spreadsheet
  const spreadsheetData = prepareRestaurantWaitlistForExport(waitlistEntries)

  // Create and return spreadsheet
  return createSpreadsheet(spreadsheetData, { type: format })
}

/**
 * Prepare restaurant waitlist data for spreadsheet export
 * @param waitlistEntries Array of restaurant waitlist entry objects
 * @returns Spreadsheet data structure
 */
function prepareRestaurantWaitlistForExport(waitlistEntries: WaitlistRestaurantJsonResponse[]) {
  // Define headings
  const headings: (keyof ExportedRestaurantWaitlist)[] = [
    'ID',
    'Name',
    'Phone',
    'Party Size',
    'Table Preference',
    'Status',
    'Quoted Wait Time',
    'Actual Wait Time',
    'Check In Time',
    'Created At',
    'Notes',
  ]

  // Transform waitlist entries into export format
  const data = waitlistEntries.map((entry) => {
    return [
      entry.id,
      entry.name,
      entry.phone || 'N/A',
      entry.party_size,
      entry.table_preference,
      entry.status,
      entry.quoted_wait_time || 'N/A',
      entry.actual_wait_time || 'N/A',
      entry.check_in_time || 'N/A',
      entry.created_at,
      entry.notes || 'N/A',
    ]
  })

  return { headings, data }
}

/**
 * Export restaurant waitlist entries and automatically download
 * @param format The format of the spreadsheet (default is CSV)
 * @param filename Optional filename for the download
 * @returns Download response
 */
export async function downloadRestaurantWaitlist(format: 'csv' | 'excel' = 'csv', filename?: string): Promise<Response> {
  const spreadsheet = await exportRestaurantWaitlist(format)

  // Use default filename if not provided
  const defaultFilename = `restaurant_waitlist_export_${new Date().toISOString().split('T')[0]}.${format}`
  return spreadsheet.download(filename || defaultFilename)
}

/**
 * Store restaurant waitlist export to disk
 * @param format The format of the spreadsheet (default is CSV)
 * @param path Optional path to store the file
 * @returns Path where the file is stored
 */
export async function storeRestaurantWaitlistExport(format: 'csv' | 'excel' = 'csv', path?: string): Promise<void> {
  const spreadsheet = await exportRestaurantWaitlist(format)

  // Use default path and filename if not provided
  const defaultPath = `restaurant_waitlist_export_${new Date().toISOString().split('T')[0]}.${format}`

  spreadsheet.store(path || defaultPath)
}
