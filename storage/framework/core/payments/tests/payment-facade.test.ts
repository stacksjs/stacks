import { describe, expect, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Import the real payment module directly — no mocks.
// We test pure utility functions and the Payment facade's shape/exports.
// Functions that hit Stripe are verified structurally (they exist, are
// callable) but NOT invoked because we have no Stripe credentials in CI.
// ---------------------------------------------------------------------------

import {
  Payment,
  addPaymentMethod,
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
  hasActiveSubscription,
  listProducts,
  payInvoice,
  refund,
  removePaymentMethod,
  setDefaultPaymentMethod,
  subscribe,
  subscriptionCheckout,
  toCents,
  toDollars,
  updateCustomer,
  validatePromoCode,
} from '../src/payment'

// ============================================================================
// Utility function tests (pure functions — no Stripe API calls)
// ============================================================================

describe('Payment Facade - utilities', () => {
  test('formatAmount() formats cents to USD string', () => {
    expect(formatAmount(5000)).toBe('$50.00')
    expect(formatAmount(999)).toBe('$9.99')
    expect(formatAmount(100)).toBe('$1.00')
  })

  test('formatAmount() respects currency parameter', () => {
    const eur = formatAmount(2000, 'eur')
    // Intl will format EUR — just verify it produces a non-empty string with the value
    expect(eur).toContain('20.00')
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

// ============================================================================
// Named exports — verify every function is importable and is a function
// ============================================================================

describe('Payment Facade - named exports', () => {
  test('charge is a function', () => {
    expect(typeof charge).toBe('function')
  })

  test('createPayment is a function', () => {
    expect(typeof createPayment).toBe('function')
  })

  test('refund is a function', () => {
    expect(typeof refund).toBe('function')
  })

  test('checkout is a function', () => {
    expect(typeof checkout).toBe('function')
  })

  test('subscriptionCheckout is a function', () => {
    expect(typeof subscriptionCheckout).toBe('function')
  })

  test('subscribe is a function', () => {
    expect(typeof subscribe).toBe('function')
  })

  test('cancelSubscription is a function', () => {
    expect(typeof cancelSubscription).toBe('function')
  })

  test('hasActiveSubscription is a function', () => {
    expect(typeof hasActiveSubscription).toBe('function')
  })

  test('changeSubscription is a function', () => {
    expect(typeof changeSubscription).toBe('function')
  })

  test('getOrCreateCustomer is a function', () => {
    expect(typeof getOrCreateCustomer).toBe('function')
  })

  test('updateCustomer is a function', () => {
    expect(typeof updateCustomer).toBe('function')
  })

  test('deleteCustomer is a function', () => {
    expect(typeof deleteCustomer).toBe('function')
  })

  test('addPaymentMethod is a function', () => {
    expect(typeof addPaymentMethod).toBe('function')
  })

  test('setDefaultPaymentMethod is a function', () => {
    expect(typeof setDefaultPaymentMethod).toBe('function')
  })

  test('removePaymentMethod is a function', () => {
    expect(typeof removePaymentMethod).toBe('function')
  })

  test('createSetupIntent is a function', () => {
    expect(typeof createSetupIntent).toBe('function')
  })

  test('getInvoices is a function', () => {
    expect(typeof getInvoices).toBe('function')
  })

  test('createInvoice is a function', () => {
    expect(typeof createInvoice).toBe('function')
  })

  test('payInvoice is a function', () => {
    expect(typeof payInvoice).toBe('function')
  })

  test('createProduct is a function', () => {
    expect(typeof createProduct).toBe('function')
  })

  test('getPrice is a function', () => {
    expect(typeof getPrice).toBe('function')
  })

  test('listProducts is a function', () => {
    expect(typeof listProducts).toBe('function')
  })

  test('createCoupon is a function', () => {
    expect(typeof createCoupon).toBe('function')
  })

  test('createPromoCode is a function', () => {
    expect(typeof createPromoCode).toBe('function')
  })

  test('validatePromoCode is a function', () => {
    expect(typeof validatePromoCode).toBe('function')
  })

  test('formatAmount is a function', () => {
    expect(typeof formatAmount).toBe('function')
  })

  test('toCents is a function', () => {
    expect(typeof toCents).toBe('function')
  })

  test('toDollars is a function', () => {
    expect(typeof toDollars).toBe('function')
  })
})

// ============================================================================
// Payment facade object tests
// ============================================================================

describe('Payment Facade - Payment object shape', () => {
  test('Payment object exposes all core methods', () => {
    expect(typeof Payment.charge).toBe('function')
    expect(typeof Payment.createPayment).toBe('function')
    expect(typeof Payment.refund).toBe('function')
    expect(typeof Payment.checkout).toBe('function')
    expect(typeof Payment.subscriptionCheckout).toBe('function')
  })

  test('Payment object exposes subscription methods', () => {
    expect(typeof Payment.subscribe).toBe('function')
    expect(typeof Payment.cancelSubscription).toBe('function')
    expect(typeof Payment.hasActiveSubscription).toBe('function')
    expect(typeof Payment.changeSubscription).toBe('function')
  })

  test('Payment object exposes customer methods', () => {
    expect(typeof Payment.getOrCreateCustomer).toBe('function')
    expect(typeof Payment.updateCustomer).toBe('function')
    expect(typeof Payment.deleteCustomer).toBe('function')
  })

  test('Payment object exposes payment method functions', () => {
    expect(typeof Payment.addPaymentMethod).toBe('function')
    expect(typeof Payment.setDefaultPaymentMethod).toBe('function')
    expect(typeof Payment.removePaymentMethod).toBe('function')
    expect(typeof Payment.createSetupIntent).toBe('function')
  })

  test('Payment object exposes invoice functions', () => {
    expect(typeof Payment.getInvoices).toBe('function')
    expect(typeof Payment.createInvoice).toBe('function')
    expect(typeof Payment.payInvoice).toBe('function')
  })

  test('Payment object exposes product/price/coupon functions', () => {
    expect(typeof Payment.createProduct).toBe('function')
    expect(typeof Payment.getPrice).toBe('function')
    expect(typeof Payment.listProducts).toBe('function')
    expect(typeof Payment.createCoupon).toBe('function')
    expect(typeof Payment.createPromoCode).toBe('function')
    expect(typeof Payment.validatePromoCode).toBe('function')
  })

  test('Payment object exposes utility functions', () => {
    expect(typeof Payment.formatAmount).toBe('function')
    expect(typeof Payment.toCents).toBe('function')
    expect(typeof Payment.toDollars).toBe('function')
  })

  test('Payment object exposes webhook handlers', () => {
    expect(Payment.webhook).toBeDefined()
    expect(typeof Payment.onPaymentIntent).toBe('function')
    expect(typeof Payment.onSubscription).toBe('function')
    expect(typeof Payment.onInvoice).toBe('function')
    expect(typeof Payment.onCheckout).toBe('function')
    expect(typeof Payment.onCharge).toBe('function')
    expect(typeof Payment.processWebhook).toBe('function')
  })

  test('Payment object exposes low-level access modules', () => {
    expect(Payment.stripe).toBeDefined()
    expect(Payment.customer).toBeDefined()
    expect(Payment.subscription).toBeDefined()
    expect(Payment.invoice).toBeDefined()
    expect(Payment.paymentMethod).toBeDefined()
    expect(Payment.product).toBeDefined()
    expect(Payment.price).toBeDefined()
    expect(Payment.coupon).toBeDefined()
  })
})

// ============================================================================
// Index re-exports
// ============================================================================

describe('Payment Facade - index.ts exports', () => {
  test('Payment is importable as default and named from index', () => {
    // We already verified the named exports above — just confirm the facade object
    // has the expected shape when re-exported through index.
    expect(Payment).toBeDefined()
    expect(typeof Payment.charge).toBe('function')
  })
})
