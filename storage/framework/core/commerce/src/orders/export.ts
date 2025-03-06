import type { OrdersTable } from '../../../../orm/src/models/Order'
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
export async function exportOrders(format: 'csv' | 'excel' = 'csv') {
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
async function fetchAllWithDetails(): Promise<(OrdersTable & {
  customer?: { name: string }
  order_items?: Array<{
    product?: { name: string }
    quantity: number
    price: number
  }>
})[]> {
  // Fetch orders with customer details
  const ordersWithCustomers = await db
    .selectFrom('orders')
    .leftJoin('customers', 'customers.id', 'orders.customer_id')
    .selectAll('orders')
    .select('customers.name as customer_name')
    .execute()

  // Fetch order items for all orders in a single query
  const orderItems = await db
    .selectFrom('order_items')
    .leftJoin('products', 'products.id', 'order_items.product_id')
    .select([
      'order_items.order_id',
      'products.name as product_name',
      'order_items.quantity',
      'order_items.price',
    ])
    .execute()

  // Group order items by order ID
  const orderItemsMap = orderItems.reduce((acc, item) => {
    if (!acc[item.order_id]) {
      acc[item.order_id] = []
    }
    acc[item.order_id].push({
      product: { name: item.product_name },
      quantity: item.quantity,
      price: item.price,
    })
    return acc
  }, {} as Record<number, Array<{ product?: { name: string }, quantity: number, price: number }>>)

  // Attach order items to each order
  return ordersWithCustomers.map(order => ({
    ...order,
    customer: { name: order.customer_name },
    order_items: orderItemsMap[order.id] || [],
  }))
}

/**
 * Prepare orders data for spreadsheet export
 * @param orders Array of order objects
 * @returns Spreadsheet data structure
 */
function prepareOrdersForExport(orders: (OrdersTable & {
  customer?: { name: string }
  order_items?: Array<{
    product?: { name: string }
    quantity: number
    price: number
  }>
})[]) {
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
export async function downloadOrders(format: 'csv' | 'excel' = 'csv', filename?: string) {
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
export async function storeOrdersExport(format: 'csv' | 'excel' = 'csv', path?: string) {
  const spreadsheet = await exportOrders(format)

  // Use default path and filename if not provided
  const defaultPath = `orders_export_${new Date().toISOString().split('T')[0]}.${format}`
  return spreadsheet.store(path || defaultPath)
}
