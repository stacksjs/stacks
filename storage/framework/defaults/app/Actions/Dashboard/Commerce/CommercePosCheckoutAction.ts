import type { RequestInstance } from '@stacksjs/types'
import { randomUUIDv7 } from 'bun'
import { Action } from '@stacksjs/actions'
import { orders } from '@stacksjs/commerce'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { Category, Customer, Manufacturer, OrderItem, Payment, Product, TaxRate } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import {
  calculateCommercePosSale,
  CommercePosAvailabilityError,
  deriveCommercePosTaxRate,
  normalizeCommercePosProduct,
  parseCommercePosLines,
  selectCommercePosTaxRate,
} from './commerce-pos'
import {
  normalizeCommerceProductRecord,
  normalizeCommerceCurrency,
  normalizeManufacturerOption,
  normalizeProductOption,
} from './commerce-product-records'

function field(record: any, ...names: string[]): unknown {
  for (const name of names) {
    const value = typeof record?.get === 'function' ? record.get(name) : record?.[name]
    if (value !== null && value !== undefined)
      return value
  }
  return undefined
}

function receiptError(source: string, fieldName: string, expectation: string): TypeError {
  return new TypeError(`${source}.${fieldName} must be ${expectation}.`)
}

function receiptId(input: unknown, source: string, fieldName = 'id'): number {
  const result = typeof input === 'number'
    ? input
    : typeof input === 'string' && /^\d+$/.test(input.trim())
      ? Number(input)
      : Number.NaN
  if (!Number.isSafeInteger(result) || result <= 0)
    throw receiptError(source, fieldName, 'a positive integer')
  return result
}

function receiptNumber(
  input: unknown,
  source: string,
  fieldName: string,
  options: { min?: number, integer?: boolean } = {},
): number {
  const result = typeof input === 'number'
    ? input
    : typeof input === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(input.trim())
      ? Number(input)
      : Number.NaN
  if (!Number.isFinite(result))
    throw receiptError(source, fieldName, 'a finite number')
  if (options.integer && !Number.isInteger(result))
    throw receiptError(source, fieldName, 'an integer')
  if (options.min !== undefined && result < options.min)
    throw receiptError(source, fieldName, `at least ${options.min}`)
  return result
}

function receiptText(input: unknown, source: string, fieldName: string): string {
  if (typeof input !== 'string' || !input.trim())
    throw receiptError(source, fieldName, 'a non-empty string')
  return input.trim()
}

function receiptOptionalText(input: unknown, source: string, fieldName: string): string {
  if (input === undefined || input === null || input === '')
    return ''
  if (typeof input !== 'string')
    throw receiptError(source, fieldName, 'a string or null')
  return input.trim()
}

function receiptTimestamp(input: unknown, source: string, fieldName: string): string {
  // Postgres and MySQL drivers return Date instances for timestamp columns;
  // SQLite stores TEXT and returns strings. Accept both.
  if (input instanceof Date) {
    if (!Number.isFinite(input.getTime()))
      throw receiptError(source, fieldName, 'a valid timestamp')
    return input.toISOString()
  }
  const raw = receiptText(input, source, fieldName)
  const date = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw)
  if (!Number.isFinite(date.getTime()))
    throw receiptError(source, fieldName, 'a valid timestamp')
  return date.toISOString()
}

async function existingReceipt(order: any) {
  const orderId = receiptId(field(order, 'id'), 'Order')
  const source = `Order ${orderId}`
  const itemRows = await OrderItem.where('order_id', orderId).get()
  const productIds = itemRows.map((item, index) =>
    receiptId(field(item, 'product_id', 'productId'), `OrderItem ${index + 1}`, 'product_id'),
  )
  const [products, payments] = await Promise.all([
    productIds.length > 0 ? Product.where('id', 'in', productIds).get() : [],
    Payment.where('order_id', orderId).get(),
  ])
  const names = new Map(products.map((product) => {
    const productId = receiptId(field(product, 'id'), 'Product')
    return [productId, receiptText(field(product, 'name'), `Product ${productId}`, 'name')]
  }))
  const taxAmount = receiptNumber(field(order, 'tax_amount', 'taxAmount'), source, 'tax_amount', { min: 0 })
  const totalAmount = receiptNumber(field(order, 'total_amount', 'totalAmount'), source, 'total_amount', { min: 0 })
  const subtotal = Math.round((totalAmount - taxAmount + Number.EPSILON) * 100) / 100
  if (subtotal < 0)
    throw new TypeError(`${source}.tax_amount cannot exceed total_amount.`)
  const taxRate = deriveCommercePosTaxRate(subtotal, taxAmount)
  const referenceNumber = receiptText(
    field(payments[0], 'reference_number', 'referenceNumber'),
    `Payment for ${source}`,
    'reference_number',
  )
  return {
    orderId,
    referenceNumber,
    lines: itemRows.map((item, index) => {
      const itemSource = `OrderItem ${index + 1}`
      const productId = receiptId(field(item, 'product_id', 'productId'), itemSource, 'product_id')
      const name = names.get(productId)
      if (!name)
        throw new TypeError(`${itemSource}.product_id references missing Product ${productId}.`)
      const quantity = receiptNumber(field(item, 'quantity'), itemSource, 'quantity', { min: 1, integer: true })
      const unitPrice = receiptNumber(field(item, 'price'), itemSource, 'price', { min: 0 })
      return {
        productId,
        name,
        quantity,
        unitPrice,
        lineTotal: Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100,
        specialInstructions: receiptOptionalText(
          field(item, 'special_instructions', 'specialInstructions'),
          itemSource,
          'special_instructions',
        ),
      }
    }),
    subtotal,
    taxRate,
    taxAmount,
    totalAmount,
    currency: normalizeCommerceCurrency(field(order, 'currency')),
    createdAt: receiptTimestamp(field(order, 'created_at', 'createdAt'), source, 'created_at'),
  }
}

export default new Action({
  name: 'CommercePosCheckoutAction',
  description: 'Atomically places a server-priced cash sale with order lines, payment, and inventory updates.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const rawIdempotencyKey = request.get('idempotencyKey')
    const idempotencyKey = typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim() : ''
    if (idempotencyKey.length < 8 || idempotencyKey.length > 255)
      return response.json({ message: 'A valid checkout idempotency key is required.' }, 422)

    let existing
    try {
      existing = await orders.findOrderByIdempotencyKey(idempotencyKey)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Checkout records could not be read.', 'CommercePosCheckoutAction')
    }
    if (existing) {
      try {
        return {
          ok: true,
          idempotent: true,
          receipt: await existingReceipt(existing),
        }
      }
      catch (error) {
        return dashboardOperationalError(error, 'Existing receipt records could not be read.', 'CommercePosCheckoutAction')
      }
    }

    const parsed = parseCommercePosLines(request.get('items'))
    if (parsed.error)
      return response.json({ message: parsed.error }, 422)

    const rawOrderType = request.get('orderType')
    const orderType = rawOrderType === undefined || rawOrderType === null || rawOrderType === ''
      ? 'TAKEOUT'
      : typeof rawOrderType === 'string'
        ? rawOrderType.toUpperCase()
        : ''
    if (!['DINE_IN', 'TAKEOUT'].includes(orderType))
      return response.json({ message: 'Order type must be dine in or takeout.' }, 422)

    const rawPaymentMethod = request.get('paymentMethod')
    const paymentMethod = rawPaymentMethod === undefined || rawPaymentMethod === null || rawPaymentMethod === ''
      ? 'cash'
      : typeof rawPaymentMethod === 'string'
        ? rawPaymentMethod
        : ''
    if (paymentMethod !== 'cash')
      return response.json({ message: 'Only recorded cash payments are available in this POS flow.' }, 422)

    const rawCustomerId = request.get('customerId')
    const customerId = rawCustomerId === undefined || rawCustomerId === null || rawCustomerId === ''
      ? 0
      : typeof rawCustomerId === 'number'
        ? rawCustomerId
        : Number.NaN
    if (customerId && (!Number.isInteger(customerId) || customerId <= 0))
      return response.json({ message: 'Select a valid customer.' }, 422)
    let customer
    try {
      customer = customerId ? await Customer.find(customerId) : null
    }
    catch (error) {
      return dashboardOperationalError(error, 'Customer records could not be read.', 'CommercePosCheckoutAction')
    }
    if (customerId && !customer)
      return response.json({ message: 'The selected customer no longer exists.' }, 422)

    const rawSpecialInstructions = request.get('specialInstructions')
    const specialInstructions = rawSpecialInstructions === undefined || rawSpecialInstructions === null
      ? ''
      : typeof rawSpecialInstructions === 'string'
        ? rawSpecialInstructions.trim()
        : ''
    if (rawSpecialInstructions !== undefined && rawSpecialInstructions !== null && typeof rawSpecialInstructions !== 'string')
      return response.json({ message: 'Order instructions must be text.' }, 422)
    if (specialInstructions.length > 1000)
      return response.json({ message: 'Order instructions must be 1,000 characters or fewer.' }, 422)

    const productIds = parsed.lines.map(line => line.productId)
    let products
    let taxRates
    try {
      const [productRows, categories, manufacturers, persistedTaxRates] = await Promise.all([
        Product.where('id', 'in', productIds).get(),
        Category.orderBy('name', 'asc').limit(500).get(),
        Manufacturer.orderBy('manufacturer', 'asc').limit(500).get(),
        TaxRate.orderBy('id', 'asc').limit(500).get(),
      ])
      const categoryMap = new Map(categories.map(normalizeProductOption).map(option => [option.id, option.label]))
      const manufacturerMap = new Map(manufacturers.map(normalizeManufacturerOption).map(option => [option.id, option.label]))
      const emptyCounts = new Map<string, number>()
      products = productRows.map(product => normalizeCommercePosProduct(normalizeCommerceProductRecord(
        product,
        categoryMap,
        manufacturerMap,
        emptyCounts,
        emptyCounts,
        emptyCounts,
      )))
      taxRates = persistedTaxRates
    }
    catch (error) {
      return dashboardOperationalError(error, 'Product records could not be read.', 'CommercePosCheckoutAction')
    }
    if (products.length !== productIds.length)
      return response.json({ message: 'One or more products no longer exist.' }, 422)

    let taxRate
    try {
      taxRate = selectCommercePosTaxRate(taxRates)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Tax rate records could not be read.', 'CommercePosCheckoutAction')
    }

    let sale
    try {
      sale = calculateCommercePosSale(products, parsed.lines, taxRate)
    }
    catch (error) {
      if (error instanceof CommercePosAvailabilityError)
        return response.json({ message: error.message }, 409)

      return dashboardOperationalError(error, 'Sale totals could not be calculated.', 'CommercePosCheckoutAction')
    }

    const currency = normalizeCommerceCurrency((config as any).commerce?.currency)
    const transactionId = randomUUIDv7()
    const referenceNumber = `POS-${transactionId.slice(0, 12).toUpperCase()}`
    let result
    try {
      result = await orders.placeOrder({
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
    }
    catch (error) {
      return dashboardOperationalError(error, 'The sale could not be completed atomically.', 'CommercePosCheckoutAction', 500)
    }

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
      const status = result.reason === 'unknown' ? 500 : 409
      return response.json({ message }, status)
    }

    const order = result.order as any
    let persistedOrderId: number
    let persistedCreatedAt: string
    try {
      persistedOrderId = receiptId(field(order, 'id'), 'Order')
      persistedCreatedAt = receiptTimestamp(
        field(order, 'created_at', 'createdAt'),
        `Order ${persistedOrderId}`,
        'created_at',
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Created order record could not be read.', 'CommercePosCheckoutAction', 500)
    }
    return {
      ok: true,
      idempotent: false,
      receipt: {
        orderId: persistedOrderId,
        referenceNumber,
        lines: sale.lines,
        subtotal: sale.subtotal,
        taxRate: sale.taxRate,
        taxAmount: sale.taxAmount,
        totalAmount: sale.totalAmount,
        currency,
        createdAt: persistedCreatedAt,
      },
    }
  },
})
