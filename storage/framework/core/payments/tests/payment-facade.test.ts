import type { PaymentDriver } from '../src/driver'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { config } from '@stacksjs/config'
import { PaymentUnsupportedError, registerPaymentDriver } from '../src/driver'
import * as index from '../src/index'
import {
  addPaymentMethod,
  billingPortal,
  cancelSubscription,
  changeSubscription,
  charge,
  checkout,
  createCoupon,
  createInvoice,
  createPayment,
  createProduct,
  createPromoCode,
  createSetupIntent,
  deleteCustomer,
  formatAmount,
  getInvoices,
  getOrCreateCustomer,
  getPrice,
  listProducts,
  Payment,
  payInvoice,
  paymentMethods,
  refund,
  removePaymentMethod,
  setDefaultPaymentMethod,
  subscribe,
  subscriptionCheckout,
  subscriptions,
  toCents,
  toDollars,
  updateCustomer,
  validatePromoCode,
} from '../src/payment'

/**
 * The Payment facade (stacksjs/stacks#665). Its provider-neutral half goes
 * through whichever driver config.payment.driver names; its Stripe half
 * refuses under any other. Both are tested against a real registered driver
 * and the real config - nothing here is a module mock.
 */

const calls: Array<[string, unknown[]]> = []
const recording = new Proxy({ name: 'facade-test', capabilities: new Set() } as Record<string, unknown>, {
  get: (target, key: string) => key in target || key === 'then'
    ? target[key]
    : async (...args: unknown[]) => {
      calls.push([key, args])
      return { from: key }
    },
}) as unknown as PaymentDriver

registerPaymentDriver('facade-test', () => recording)

const payment = (config as { payment: { driver?: string } }).payment
const configured = payment.driver

beforeAll(() => {
  payment.driver = 'facade-test'
})

afterAll(() => {
  payment.driver = configured
})

beforeEach(() => {
  calls.length = 0
})

const payer = { id: 7, email: 'payer@example.com' }

describe('Payment facade - provider-neutral, through the configured driver', () => {
  test('charge and createPayment take money in minor units', async () => {
    await charge(payer, { amount: 2999, currency: 'eur' }, 'pm_1', { reference: 'order-1' })
    await createPayment(payer, { amount: 900, currency: 'usd' }, { returnUrl: 'https://app.test/done' })

    expect(calls).toEqual([
      ['charge', [payer, { amount: 2999, currency: 'eur' }, 'pm_1', { reference: 'order-1' }]],
      ['createPayment', [payer, { amount: 900, currency: 'usd' }, { returnUrl: 'https://app.test/done' }]],
    ])
  })

  test('refund refunds all of a payment, or the amount given', async () => {
    await refund('pi_1')
    await refund('pi_1', { amount: { amount: 500, currency: 'eur' }, reason: 'requested_by_customer' })

    expect(calls).toEqual([
      ['refund', ['pi_1', {}]],
      ['refund', ['pi_1', { amount: { amount: 500, currency: 'eur' }, reason: 'requested_by_customer' }]],
    ])
  })

  test('checkout passes the request as given', async () => {
    const request = { mode: 'payment' as const, lines: [{ price: 'price_1', quantity: 2 }], successUrl: 'https://app.test/ok' }
    expect(await checkout(payer, request)).toEqual({ from: 'checkout' } as never)
    expect(calls).toEqual([['checkout', [payer, request]]])
  })

  test('subscriptionCheckout is a checkout of one price in subscription mode', async () => {
    await subscriptionCheckout(payer, 'price_pro', { successUrl: 'https://app.test/welcome', cancelUrl: 'https://app.test/pricing', metadata: { user_id: '7' } })
    await subscriptionCheckout(payer, 'price_team', { successUrl: 'https://app.test/welcome', quantity: 5 })

    expect(calls).toEqual([
      ['checkout', [payer, { successUrl: 'https://app.test/welcome', cancelUrl: 'https://app.test/pricing', metadata: { user_id: '7' }, mode: 'subscription', lines: [{ price: 'price_pro', quantity: 1 }] }]],
      ['checkout', [payer, { successUrl: 'https://app.test/welcome', mode: 'subscription', lines: [{ price: 'price_team', quantity: 5 }] }]],
    ])
  })

  test('subscriptions: subscribe, cancel now or at the period end, and list', async () => {
    await subscribe(payer, 'pro_monthly')
    await subscribe(payer, 'pro_monthly', { type: 'team' })
    await cancelSubscription('sub_1')
    await cancelSubscription('sub_1', { atPeriodEnd: true })
    await subscriptions(payer)

    expect(calls).toEqual([
      ['subscribe', [payer, 'pro_monthly', {}]],
      ['subscribe', [payer, 'pro_monthly', { type: 'team' }]],
      ['cancelSubscription', ['sub_1', {}]],
      ['cancelSubscription', ['sub_1', { atPeriodEnd: true }]],
      ['subscriptions', [payer]],
    ])
  })

  test('customers and payment methods', async () => {
    await getOrCreateCustomer(payer)
    await paymentMethods(payer)
    await removePaymentMethod(payer, 'pm_1')

    expect(calls).toEqual([
      ['customer', [payer]],
      ['paymentMethods', [payer]],
      ['removePaymentMethod', [payer, 'pm_1']],
    ])
  })

  test('the Payment object carries the same functions', () => {
    expect(Payment.charge).toBe(charge)
    expect(Payment.checkout).toBe(checkout)
    expect(Payment.subscriptions).toBe(subscriptions)
    expect(Payment.paymentMethods).toBe(paymentMethods)
    expect(Payment.getOrCreateCustomer).toBe(getOrCreateCustomer)
  })
})

describe('Payment facade - Stripe only', () => {
  const user = { id: 7, email: 'payer@example.com' } as never

  // Each must refuse before reaching Stripe: any Stripe call here would throw
  // something else (no key, no package), not PaymentUnsupportedError.
  const stripeOnly: Array<[string, () => Promise<unknown>]> = [
    ['changeSubscription', () => changeSubscription(user, 'pro_yearly')],
    ['updateCustomer', () => updateCustomer(user, { name: 'Payer' })],
    ['deleteCustomer', () => deleteCustomer(user)],
    ['addPaymentMethod', () => addPaymentMethod(user, 'pm_1')],
    ['setDefaultPaymentMethod', () => setDefaultPaymentMethod(user, 'pm_1')],
    ['createSetupIntent', () => createSetupIntent(user)],
    ['getInvoices', () => getInvoices(user)],
    ['createInvoice', () => createInvoice('cus_1')],
    ['payInvoice', () => payInvoice('in_1')],
    ['createProduct', () => createProduct('Pro', 2900)],
    ['getPrice', () => getPrice('pro_monthly')],
    ['listProducts', () => listProducts()],
    ['createCoupon', () => createCoupon({ percentOff: 10 })],
    ['createPromoCode', () => createPromoCode('co_1', 'WELCOME')],
    ['validatePromoCode', () => validatePromoCode('WELCOME')],
    ['billingPortal', () => billingPortal('cus_1')],
  ]

  for (const [operation, call] of stripeOnly) {
    test(`${operation} refuses, naming itself, under another provider`, async () => {
      const error = await call().catch(e => e)
      expect(error).toBeInstanceOf(PaymentUnsupportedError)
      expect(error).toMatchObject({ driver: 'facade-test', operation })
    })
  }
})

describe('Payment facade - utilities', () => {
  test('formatAmount() formats cents to USD string', () => {
    expect(formatAmount(5000)).toBe('$50.00')
    expect(formatAmount(999)).toBe('$9.99')
    expect(formatAmount(100)).toBe('$1.00')
  })

  test('formatAmount() respects currency parameter', () => {
    expect(formatAmount(2000, 'eur')).toContain('20.00')
  })

  test('toCents() converts dollars to cents', () => {
    expect(toCents(50)).toBe(5000)
    expect(toCents(9.99)).toBe(999)
    expect(toCents(0)).toBe(0)
  })

  test('toDollars() converts cents to dollars', () => {
    expect(toDollars(5000)).toBe(50)
    expect(toDollars(999)).toBe(9.99)
    expect(toDollars(0)).toBe(0)
  })
})

describe('Payment facade - package exports', () => {
  test('the package exports the facade as Payment and its functions by name', () => {
    expect(index.Payment).toBe(Payment)
    expect(index.charge).toBe(charge)
    expect(index.paymentMethods).toBe(paymentMethods)
    expect(index.subscriptions).toBe(subscriptions)
  })
})
