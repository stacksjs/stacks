import type { CommerceSqlRunner } from './commerce-sql'
import { db } from '@stacksjs/database/runtime'
import { sqlRows } from './commerce-sql'
import type { PrintDeviceRecord, PrintDeviceSummary } from './print-device-records'
import { normalizePrintDeviceRecord, summarizePrintDevices } from './print-device-records'

/**
 * Every print device, newest first (stacksjs/stacks#3218).
 *
 * Print devices are the store's own hardware, configuration the page needs
 * whole: it offers their locations as a filter and totals their prints. It
 * used to read the newest 500, so an older device could not be found or
 * edited, and the cards and the location filter saw only those 500.
 */
export async function readPrintDevices(run: CommerceSqlRunner = db): Promise<{ records: PrintDeviceRecord[], summary: PrintDeviceSummary }> {
  const records = sqlRows(await run.unsafe('SELECT * FROM print_devices ORDER BY id DESC').execute()).map(normalizePrintDeviceRecord)
  return { records, summary: summarizePrintDevices(records) }
}
