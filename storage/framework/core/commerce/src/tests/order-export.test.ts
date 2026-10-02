import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { exportOrders, fetchOrdersForExport, prepareOrdersForExport } from '../orders/export'
import { refreshDatabase } from './setup'

/**
 * The order export read the orders and summed their items, but never attached
 * the items or the customer to the rows it handed `prepareOrdersForExport`, so
 * every exported order said "No Items" and "N/A" whatever it contained.
 *
 * These write real rows and read them back through the same path
 * `OrderExportAction` takes.
 */

beforeEach(async () => {
  await refreshDatabase()
})

async function insert(table: string, values: Record<string, unknown>): Promise<number> {
  await db.insertInto(table as any).values(values as any).execute()
  const row = await db.selectFrom(table as any).select(['id']).orderBy('id', 'desc').limit(1).executeTakeFirst() as { id: number }
  return Number(row.id)
}

async function seedOrders(): Promise<{ euroOrder: number, yenOrder: number, guestOrder: number }> {
  const ada = await insert('customers', { name: 'Ada Lovelace', email: 'ada@example.com', phone: '555-0100', status: 'Active', avatar: '' })
  const grace = await insert('customers', { name: 'Grace Hopper', email: 'grace@example.com', phone: '555-0101', status: 'Active', avatar: '' })
  const mug = await insert('products', { name: 'Enamel Mug', price: 1250, is_available: true, preparation_time: 1 })
  const beans = await insert('products', { name: 'Coffee Beans', price: 1999, is_available: true, preparation_time: 1 })

  // Inserted in this order so a customer id and an order id disagree: a join
  // that let customers.id overwrite orders.id would show up as a wrong id.
  const euroOrder = await insert('orders', { status: 'PENDING', total_amount: 4498, currency: 'EUR', order_type: 'DELIVERY', customer_id: grace, created_at: '2026-10-01 10:00:00' })
  const yenOrder = await insert('orders', { status: 'DELIVERED', total_amount: 1999, currency: 'JPY', order_type: 'PICKUP', customer_id: ada, created_at: '2026-10-02 10:00:00' })
  const guestOrder = await insert('orders', { status: 'PENDING', total_amount: 0, currency: 'USD', order_type: 'PICKUP', created_at: '2026-10-03 10:00:00' })

  await insert('order_items', { order_id: euroOrder, product_id: mug, quantity: 2, price: 1250 })
  await insert('order_items', { order_id: euroOrder, product_id: beans, quantity: 1, price: 1998 })
  await insert('order_items', { order_id: yenOrder, product_id: beans, quantity: 1, price: 1999 })

  return { euroOrder, yenOrder, guestOrder }
}

describe('order export', () => {
  it('attaches each order\'s customer and line items, with their products', async () => {
    const { euroOrder, yenOrder, guestOrder } = await seedOrders()

    const orders = await fetchOrdersForExport() as any[]
    expect(orders.map(order => Number(order.id))).toEqual([euroOrder, yenOrder, guestOrder])

    const euro = orders[0]
    expect(euro.customer?.name).toBe('Grace Hopper')
    expect(euro.order_items.map((item: any) => [item.product?.name, Number(item.quantity), Number(item.price)])).toEqual([
      ['Enamel Mug', 2, 1250],
      ['Coffee Beans', 1, 1998],
    ])
    expect(euro.totalItems).toBe(3)
    expect(euro.totalPrice).toBe(4498)

    expect(orders[1].customer?.name).toBe('Ada Lovelace')
    expect(orders[2].customer).toBeUndefined()
    expect(orders[2].order_items).toEqual([])
  })

  it('lists every item with its price formatted in the order\'s currency', async () => {
    const { euroOrder, yenOrder, guestOrder } = await seedOrders()

    const { data } = prepareOrdersForExport(await fetchOrdersForExport())

    expect(data).toEqual([
      [euroOrder, 'Grace Hopper', '2026-10-01 10:00:00', '44.98 EUR', 'PENDING', 'Enamel Mug (Qty: 2, Price: 12.50 EUR) | Coffee Beans (Qty: 1, Price: 19.98 EUR)'],
      [yenOrder, 'Ada Lovelace', '2026-10-02 10:00:00', '1999 JPY', 'DELIVERED', 'Coffee Beans (Qty: 1, Price: 1999 JPY)'],
      [guestOrder, 'N/A', '2026-10-03 10:00:00', '0.00 USD', 'PENDING', 'No Items'],
    ])
  })

  it('writes the items into the CSV exportOrders produces', async () => {
    await seedOrders()

    const csv = String((await exportOrders('csv')).getContent())

    expect(csv).toContain('Enamel Mug (Qty: 2, Price: 12.50 EUR) | Coffee Beans (Qty: 1, Price: 19.98 EUR)')
    expect(csv).toContain('Grace Hopper')
    expect(csv).toContain('1999 JPY')
  })

  it('exports nothing, without querying further, when there are no orders', async () => {
    expect(await fetchOrdersForExport()).toEqual([])
  })
})
