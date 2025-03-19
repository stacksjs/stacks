import type { SpreadsheetWrapper } from 'ts-spreadsheets'
import type { OrderWithTotals } from '../types'
import { db } from '@stacksjs/database'
import { createSpreadsheet } from 'ts-spreadsheets'

/**
 * Represents the structure of an exported order
 */
export interface ExportedOrder {
  'Order ID': number
  'Customer': string
  'Date': string
  'Total': number
  'Status': string
  'Items': string
}

/**
 * Export orders to a spreadsheet
 * @param format The format of the spreadsheet (default is CSV)
 * @returns Spreadsheet object ready for download or storage
 */
export async function exportOrders(format: 'csv' | 'excel' = 'csv'): Promise<SpreadsheetWrapper> {
  // Fetch all orders with their details
  const orders = await fetchAllWithDetails()

  // Prepare data for spreadsheet
  const spreadsheetData = prepareOrdersForExport(orders)

  // Create and return spreadsheet
  return createSpreadsheet(spreadsheetData, { type: format })
}

/**
 * Fetch all orders with customer names and order items
 */
async function fetchAllWithDetails(): Promise<OrderWithTotals[] | []> {
  const ordersWithCustomers = await db
    .selectFrom('orders')
    .leftJoin('customers', 'customers.id', 'orders.customer_id')
    .selectAll('orders')
    .select(['customers.name as customer_name', 'customers.email as customer_email'])
    .execute()

  const orderIds = ordersWithCustomers.map(order => order.id)

  if (orderIds.length === 0) {
    return []
  }

  // Fetch order items related only to the fetched orders
  const allOrderItems = await db
    .selectFrom('order_items')
    .where('order_items.order_id', 'in', orderIds)
    .select([
      'order_items.order_id',
      'order_items.quantity',
      'order_items.price',
    ])
    .execute()

  const orderItemsMap = allOrderItems.reduce<Record<number, { totalItems: number, totalPrice: number }>>(
    (acc, item) => {
      if (!acc[item.order_id]) {
        acc[item.order_id] = {
          totalItems: 0,
          totalPrice: 0,
        }
      }

      acc[item.order_id].totalItems += item.quantity
      acc[item.order_id].totalPrice += item.price * item.quantity

      return acc
    },
    {},
  )

  const enrichedOrders = ordersWithCustomers.map((order) => {
    const orderItemData = orderItemsMap[order.id] || { totalItems: 0, totalPrice: 0 }

    return {
      ...order,
      totalItems: orderItemData.totalItems,
      totalPrice: orderItemData.totalPrice,
    }
  })

  return enrichedOrders as OrderWithTotals[]
}

/**
 * Prepare orders data for spreadsheet export
 * @param orders Array of order objects
 * @returns Spreadsheet data structure
 */
function prepareOrdersForExport(orders: OrderWithTotals[]) {
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
  const data = orders.map((order) => {
    // Convert items to a readable string
    const itemsString = order.order_items
      ?.map(item => `${item.product?.name} (Qty: ${item.quantity}, Price: $${item.price})`)
      .join(' | ') || 'No Items'

    return [
      order.id,
      order.customer?.name || 'N/A',
      order.created_at,
      order.total_amount,
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
