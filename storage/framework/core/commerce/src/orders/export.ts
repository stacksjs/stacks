import type { SpreadsheetWrapper } from 'ts-spreadsheets'
import type { OrderWithTotals } from '../types'
import { db } from '@stacksjs/database/runtime'
import { createSpreadsheet } from 'ts-spreadsheets'
import { formatMinor } from '../money'

/**
 * Represents the structure of an exported order
 */
export interface ExportedOrder {
  'Order ID': number
  'Customer': string
  'Date': string
  /** The stored minor units as a decimal with its currency, e.g. `19.99 USD`. */
  'Total': string
  'Status': string
  'Items': string
}

/**
 * Export orders to a spreadsheet
 * @param format The format of the spreadsheet (default is CSV)
 * @returns Spreadsheet object ready for download or storage
 */
export async function exportOrders(format: 'csv' | 'excel' = 'csv'): Promise<SpreadsheetWrapper> {
  // Fetch all orders with their customers and line items
  const orders = await fetchOrdersForExport()

  // Prepare data for spreadsheet
  const spreadsheetData = prepareOrdersForExport(orders)

  // Create and return spreadsheet
  return createSpreadsheet(spreadsheetData, { type: format })
}

/**
 * How many ids go into one `IN (...)` list. SQLite caps bound parameters per
 * statement (32766 on current builds, 999 on old ones), so a large export is
 * read in slices rather than as one statement that fails past the cap.
 */
const ID_CHUNK = 500

function chunks<T>(values: T[], size = ID_CHUNK): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size))
  return result
}

function uniqueIds(values: unknown[]): number[] {
  const ids = new Set<number>()
  for (const value of values) {
    const id = Number(value)
    if (Number.isSafeInteger(id) && id > 0)
      ids.add(id)
  }
  return [...ids]
}

/**
 * Every order with its customer and its line items (each with its product),
 * ready for `prepareOrdersForExport`.
 *
 * Four flat queries, whatever the number of orders: the orders, then the
 * customers, line items and products they reference, each read with `IN` and
 * stitched together in memory. Nothing is fetched per order.
 *
 * The orders are read on their own rather than joined to customers: a
 * `SELECT *` across that join returns two `id` columns, and the customer's
 * silently replaces the order's in the row object.
 */
export async function fetchOrdersForExport(): Promise<OrderWithTotals[]> {
  const orders = await db
    .selectFrom('orders')
    .selectAll()
    .orderBy('id', 'asc')
    .execute() as Record<string, any>[]

  if (orders.length === 0)
    return []

  const orderIds = uniqueIds(orders.map(order => order.id))
  const customerIds = uniqueIds(orders.map(order => order.customer_id))

  const customers = new Map<number, Record<string, any>>()
  for (const ids of chunks(customerIds)) {
    const rows = await db
      .selectFrom('customers')
      .where('id', 'in', ids)
      .select(['id', 'name', 'email'])
      .execute() as Record<string, any>[]
    for (const row of rows)
      customers.set(Number(row.id), row)
  }

  const items: Record<string, any>[] = []
  for (const ids of chunks(orderIds)) {
    const rows = await db
      .selectFrom('order_items')
      .where('order_id', 'in', ids)
      .select(['id', 'order_id', 'product_id', 'quantity', 'price'])
      .orderBy('id', 'asc')
      .execute() as Record<string, any>[]
    items.push(...rows)
  }

  const products = new Map<number, Record<string, any>>()
  for (const ids of chunks(uniqueIds(items.map(item => item.product_id)))) {
    const rows = await db
      .selectFrom('products')
      .where('id', 'in', ids)
      .select(['id', 'name'])
      .execute() as Record<string, any>[]
    for (const row of rows)
      products.set(Number(row.id), row)
  }

  const itemsByOrder = new Map<number, Record<string, any>[]>()
  for (const item of items) {
    const orderId = Number(item.order_id)
    const line = { ...item, product: products.get(Number(item.product_id)) }
    const lines = itemsByOrder.get(orderId)
    if (lines)
      lines.push(line)
    else
      itemsByOrder.set(orderId, [line])
  }

  return orders.map((order) => {
    const lines = itemsByOrder.get(Number(order.id)) ?? []
    const customer = customers.get(Number(order.customer_id))

    return {
      ...order,
      customer,
      customer_name: customer?.name ?? null,
      customer_email: customer?.email ?? null,
      order_items: lines,
      totalItems: lines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0),
      // Integer minor units, like every amount it is summed from.
      totalPrice: lines.reduce((sum, line) => sum + Number(line.price ?? 0) * Number(line.quantity ?? 0), 0),
    } as unknown as OrderWithTotals
  })
}

/**
 * Prepare orders data for spreadsheet export
 *
 * Amounts are stored as integer minor units, so `total_amount: 1999` in USD is
 * written as `19.99 USD`, never as `1999` or `$1999` (stacksjs/stacks#2851).
 *
 * @param orders Array of order objects
 * @returns Spreadsheet data structure
 */
export function prepareOrdersForExport(orders: OrderWithTotals[]): { headings: (keyof ExportedOrder)[], data: (string | number)[][] } {
  // Define headings
  const headings: (keyof ExportedOrder)[] = [
    'Order ID',
    'Customer',
    'Date',
    'Total',
    'Status',
    'Items',
  ]

  // Transform orders into export format
  const data = orders.map((order: any) => {
    const currency = typeof order.currency === 'string' && order.currency ? order.currency : null

    // Convert items to a readable string
    const itemsString = order.order_items
      ?.map((item: any) => `${item.product?.name || `Product #${item.product_id ?? '?'}`} (Qty: ${item.quantity}, Price: ${formatMinor(Number(item.price ?? 0), currency)})`)
      .join(' | ') || 'No Items'

    return [
      order.id,
      order.customer?.name || order.customer_name || 'N/A',
      order.created_at,
      formatMinor(Number(order.total_amount ?? 0), currency),
      order.status,
      itemsString,
    ]
  })

  return { headings, data }
}

/**
 * Export orders and automatically download
 * @param format The format of the spreadsheet (default is CSV)
 * @param filename Optional filename for the download
 * @returns Download response
 */
export async function downloadOrders(format: 'csv' | 'excel' = 'csv', filename?: string): Promise<Response> {
  const spreadsheet = await exportOrders(format)

  // Use default filename if not provided
  const defaultFilename = `orders_export_${new Date().toISOString().split('T')[0]}.${format}`
  return spreadsheet.download(filename || defaultFilename)
}

/**
 * Store orders export to disk
 * @param format The format of the spreadsheet (default is CSV)
 * @param path Optional path to store the file
 * @returns Path where the file is stored
 */
export async function storeOrdersExport(format: 'csv' | 'excel' = 'csv', path?: string): Promise<void> {
  const spreadsheet = await exportOrders(format)

  // Use default path and filename if not provided
  const defaultPath = `orders_export_${new Date().toISOString().split('T')[0]}.${format}`

  spreadsheet.store(path || defaultPath)
}
