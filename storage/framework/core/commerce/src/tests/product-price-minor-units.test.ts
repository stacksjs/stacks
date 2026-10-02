import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import {
  normalizeCommerceProductRecord,
  productPriceInputError,
  productWritePayload,
} from '../../../../defaults/app/Actions/Dashboard/Commerce/commerce-product-records'
import { formatCurrency } from '../money'
import { prepareOrdersForExport } from '../orders/export'
import { recomputeOrderTotals } from '../orders/totals'
import { store } from '../products/items/store'
import { refreshDatabase } from './setup'

/**
 * stacksjs/stacks#2851: `products.price` meant cents to order totals and
 * dollars to the dashboard, so a product saved at 19.99 totalled as 19.99
 * CENTS, and an imported 1999 showed as $1,999.00.
 *
 * This walks one price through every boundary it crosses, using the same
 * functions the dashboard does: the dialog's payload, the store action's
 * write, the table's display, the order total, and the export.
 */

const form = {
  name: 'Native Kit',
  description: 'A kit',
  price: '19.99',
  imageUrl: '',
  isAvailable: true,
  inventoryCount: '5',
  preparationTime: '1',
  allergens: '',
  nutritionalInfo: '{}',
  categoryId: '',
  manufacturerId: '',
}

beforeEach(async () => {
  await refreshDatabase()
})

describe('a product priced in the dashboard', () => {
  it('stores 19.99 as 1999, shows $19.99 and totals 1999 cents', async () => {
    // The dialog: what was typed becomes integer minor units.
    const payload = productWritePayload(form, 'USD')
    expect(payload.price).toBe(1999)

    // ProductStoreAction: snake-cases the request and stores it.
    const saved = await store(toSnakeCaseKeys(payload) as any) as Record<string, unknown>
    const productId = Number(saved.id)
    const row = await db.selectFrom('products').where('id', '=', productId).select(['price']).executeTakeFirst() as { price: number | string }
    expect(Number(row.price)).toBe(1999)

    // The products table: the record the dashboard API returns, then shown.
    const record = normalizeCommerceProductRecord(
      { ...saved, created_at: '2026-10-02 12:00:00' },
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
    )
    expect(record.price).toBe(1999)
    expect(formatCurrency(record.price, 'USD', 'en-US')).toBe('$19.99')

    // Orders read the same column as cents.
    const totals = await recomputeOrderTotals({ items: [{ productId, quantity: 1 }] })
    expect(totals.subtotalCents).toBe(1999)
    expect(totals.totalCents).toBe(1999)

    // And the export writes the decimal, not the raw integer.
    const exported = prepareOrdersForExport([{
      id: 1,
      currency: 'USD',
      created_at: '2026-10-02 12:00:00',
      total_amount: totals.totalCents,
      status: 'PENDING',
      customer: { name: 'Ada' },
      order_items: [{ quantity: 1, price: 1999, product: { name: 'Native Kit' } }],
    } as any])
    expect(exported.data[0]).toEqual([1, 'Ada', '2026-10-02 12:00:00', '19.99 USD', 'PENDING', 'Native Kit (Qty: 1, Price: 19.99 USD)'])
  })

  it('stores a JPY price with no decimals and refuses a fraction of a yen', () => {
    expect(productWritePayload({ ...form, price: '1999' }, 'JPY').price).toBe(1999)
    expect(productPriceInputError('1999.5', 'JPY')).toBe('JPY amounts have no decimal places.')
    expect(() => productWritePayload({ ...form, price: '1999.5' }, 'JPY')).toThrow('no decimal places')
  })

  it('refuses a price below one minor unit or one that is not a plain decimal', () => {
    expect(productPriceInputError('0', 'USD')).toBe('Enter at least 0.01 USD.')
    expect(productPriceInputError('19.999', 'USD')).toBe('USD amounts have at most 2 decimal places.')
    expect(productPriceInputError('$19.99', 'USD')).not.toBe('')
    expect(productPriceInputError('19.99', 'USD')).toBe('')
  })
})
