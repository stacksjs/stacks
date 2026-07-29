import { randomUUIDv7 } from 'bun'
import { Action } from '@stacksjs/actions'
import { orders } from '@stacksjs/commerce'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { Category, Customer, OrderItem, Payment, Product, TaxRate } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  calculateCommercePosSale,
  deriveCommercePosTaxRate,
  normalizeCommercePosProduct,
  parseCommercePosLines,
  selectCommercePosTaxRate,
} from './commerce-pos'
import { normalizeCommerceProductRecord } from './commerce-product-records'

function field(record: any, ...names: string[]): unknown {
  for (const name of names) {
    const value = typeof record?.get === 'function' ? record.get(name) : record?.[name]
    if (value !== null && value !== undefined)
      return value
  }
  return undefined
}

async function existingReceipt(order: any) {
  const orderId = Number(field(order, 'id') || 0)
  const itemRows = orderId > 0 ? await OrderItem.where('order_id', orderId).get() : []
  const productIds = itemRows.map(item => Number(field(item, 'product_id', 'productId') || 0)).filter(Boolean)
  const [products, payments] = await Promise.all([
    productIds.length > 0 ? Product.where('id', 'in', productIds).get() : [],
    orderId > 0 ? Payment.where('order_id', orderId).get() : [],
  ])
  const names = new Map(products.map(product => [
    Number(field(product, 'id') || 0),
    String(field(product, 'name') || 'Product'),
  ]))
  const taxAmount = Number(field(order, 'tax_amount', 'taxAmount') || 0)
  const totalAmount = Number(field(order, 'total_amount', 'totalAmount') || 0)
  const subtotal = Math.max(0, Math.round((totalAmount - taxAmount + Number.EPSILON) * 100) / 100)
  const taxRate = deriveCommercePosTaxRate(subtotal, taxAmount)
  return {
    orderId,
    referenceNumber: String(field(payments[0], 'reference_number', 'referenceNumber') || ''),
    lines: itemRows.map(item => ({
      productId: Number(field(item, 'product_id', 'productId') || 0),
      name: names.get(Number(field(item, 'product_id', 'productId') || 0)) || 'Product',
      quantity: Number(field(item, 'quantity') || 0),
      unitPrice: Number(field(item, 'price') || 0),
      lineTotal: Math.round((
        Number(field(item, 'price') || 0) * Number(field(item, 'quantity') || 0)
        + Number.EPSILON
      ) * 100) / 100,
      specialInstructions: String(field(item, 'special_instructions', 'specialInstructions') || ''),
    })),
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
    currency: String(field(order, 'currency') || 'USD'),
    createdAt: String(field(order, 'created_at', 'createdAt') || ''),
  }
}

export default new Action({
  name: 'CommercePosCheckoutAction',
  description: 'Atomically places a server-priced cash sale with order lines, payment, and inventory updates.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const idempotencyKey = String(request.get('idempotencyKey') || '').trim()
    if (idempotencyKey.length < 8 || idempotencyKey.length > 255)
      return response.json({ message: 'A valid checkout idempotency key is required.' }, 422)

    const existing = await orders.findOrderByIdempotencyKey(idempotencyKey)
    if (existing) {
      return {
        ok: true,
        idempotent: true,
        receipt: await existingReceipt(existing),
      }
    }

    const parsed = parseCommercePosLines(request.get('items'))
    if (parsed.error)
      return response.json({ message: parsed.error }, 422)

    const orderType = String(request.get('orderType') || 'TAKEOUT').toUpperCase()
    if (!['DINE_IN', 'TAKEOUT'].includes(orderType))
      return response.json({ message: 'Order type must be dine in or takeout.' }, 422)

    const paymentMethod = String(request.get('paymentMethod') || 'cash')
    if (paymentMethod !== 'cash')
      return response.json({ message: 'Only recorded cash payments are available in this POS flow.' }, 422)

    const customerId = Number(request.get('customerId') || 0)
    if (customerId && (!Number.isInteger(customerId) || customerId <= 0))
      return response.json({ message: 'Select a valid customer.' }, 422)
    const customer = customerId ? await Customer.find(customerId) : null
    if (customerId && !customer)
      return response.json({ message: 'The selected customer no longer exists.' }, 422)

    const specialInstructions = String(request.get('specialInstructions') || '').trim()
    if (specialInstructions.length > 1000)
      return response.json({ message: 'Order instructions must be 1,000 characters or fewer.' }, 422)

    const productIds = parsed.lines.map(line => line.productId)
    const [productRows, categories, taxRates] = await Promise.all([
      Product.where('id', 'in', productIds).get(),
      Category.orderBy('name', 'asc').limit(500).get(),
      TaxRate.orderBy('id', 'asc').limit(500).get(),
    ])
    const categoryMap = new Map(categories.map(category => [
      String(category.get('id') || ''),
      String(category.get('name') || ''),
    ]))
    const emptyCounts = new Map<string, number>()
    const products = productRows.map(product => normalizeCommercePosProduct(normalizeCommerceProductRecord(
      product,
      categoryMap,
      new Map(),
      emptyCounts,
      emptyCounts,
      emptyCounts,
    )))
    if (products.length !== productIds.length)
      return response.json({ message: 'One or more products no longer exist.' }, 422)

    let sale
    try {
      sale = calculateCommercePosSale(products, parsed.lines, selectCommercePosTaxRate(taxRates))
    }
    catch (error) {
      return response.json({ message: error instanceof Error ? error.message : String(error) }, 422)
    }

    const currency = String((config as any).commerce?.currency || 'USD').toUpperCase()
    const transactionId = randomUUIDv7()
    const referenceNumber = `POS-${transactionId.slice(0, 12).toUpperCase()}`
    const result = await orders.placeOrder({
      idempotencyKey,
      order: {
        customer_id: customerId || null,
        status: 'DELIVERED',
        total_amount: sale.totalAmount,
        currency,
        tax_amount: sale.taxAmount,
        discount_amount: 0,
        delivery_fee: 0,
        tip_amount: 0,
        order_type: orderType,
        special_instructions: specialInstructions || null,
      } as any,
      items: sale.lines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        price: line.unitPrice,
        specialInstructions: line.specialInstructions,
      })),
      payment: {
        customer_id: customerId || null,
        amount: sale.totalAmount,
        method: 'cash',
        status: 'completed',
        currency,
        reference_number: referenceNumber,
        transaction_id: transactionId,
        payment_provider: 'pos',
        notes: specialInstructions || null,
      } as any,
      inventory: sale.lines.map(line => ({ id: line.productId, delta: -line.quantity })),
    })

    if (!result.ok) {
      if (result.reason === 'unknown') {
        log.error('[dashboard:pos] Atomic sale failed', {
          failedAt: result.failedAt,
          error: result.error,
        })
      }
      const message = result.reason === 'out-of-stock'
        ? 'Inventory changed during checkout. Refresh the catalog and review the cart.'
        : result.reason === 'duplicate-idempotency-key'
          ? 'This checkout is already being processed. Retry once.'
          : 'The sale could not be completed atomically.'
      return response.json({ message }, result.reason === 'out-of-stock' ? 409 : 422)
    }

    const order = result.order as any
    return {
      ok: true,
      idempotent: false,
      receipt: {
        orderId: Number(field(order, 'id') || 0),
        referenceNumber,
        lines: sale.lines,
        subtotal: sale.subtotal,
        taxRate: sale.taxRate,
        taxAmount: sale.taxAmount,
        totalAmount: sale.totalAmount,
        currency,
        createdAt: String(field(order, 'created_at', 'createdAt') || ''),
      },
    }
  },
})
