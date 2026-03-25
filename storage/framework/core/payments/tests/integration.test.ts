import { describe, expect, test } from 'bun:test'
import {
  Payment,
  charge,
  createPayment,
  refund,
  checkout,
  subscriptionCheckout,
  subscribe,
  cancelSubscription,
  hasActiveSubscription,
  changeSubscription,
  getOrCreateCustomer,
  updateCustomer,
  deleteCustomer,
  addPaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
  createSetupIntent,
  getInvoices,
  createInvoice,
  payInvoice,
  createProduct,
  getPrice,
  listProducts,
  createCoupon,
  createPromoCode,
  validatePromoCode,
  formatAmount,
  toCents,
  toDollars,
} from '../src/payment'

// ============================================================================
// Pure Utility Functions - Real logic, no Stripe API calls
// ============================================================================

describe('Payments - toCents', () => {
  test('converts whole dollars to cents', () => {
    expect(toCents(10)).toBe(1000)
    expect(toCents(1)).toBe(100)
    expect(toCents(100)).toBe(10000)
  })

  test('converts fractional dollars to cents', () => {
    expect(toCents(9.99)).toBe(999)
    expect(toCents(0.01)).toBe(1)
    expect(toCents(1.5)).toBe(150)
    expect(toCents(49.95)).toBe(4995)
  })

  test('handles zero', () => {
    expect(toCents(0)).toBe(0)
  })

  test('rounds correctly for floating-point edge cases', () => {
    // Math.round is used internally so this should be safe
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(0.1)).toBe(10)
    expect(toCents(0.2)).toBe(20)
  })
})

describe('Payments - toDollars', () => {
  test('converts whole cent amounts to dollars', () => {
    expect(toDollars(1000)).toBe(10)
    expect(toDollars(100)).toBe(1)
    expect(toDollars(10000)).toBe(100)
  })

  test('converts fractional cent amounts to dollars', () => {
    expect(toDollars(999)).toBe(9.99)
    expect(toDollars(1)).toBe(0.01)
    expect(toDollars(150)).toBe(1.5)
    expect(toDollars(4995)).toBe(49.95)
  })

  test('handles zero', () => {
    expect(toDollars(0)).toBe(0)
  })
})

describe('Payments - formatAmount', () => {
  test('formats cents as USD currency string', () => {
    expect(formatAmount(5000)).toBe('$50.00')
    expect(formatAmount(999)).toBe('$9.99')
    expect(formatAmount(100)).toBe('$1.00')
    expect(formatAmount(1)).toBe('$0.01')
  })

  test('formats zero amount', () => {
    expect(formatAmount(0)).toBe('$0.00')
  })

  test('respects currency parameter', () => {
    const eur = formatAmount(2000, 'eur')
    expect(eur).toContain('20.00')
  })

  test('handles large amounts', () => {
    const result = formatAmount(99999999)
    expect(result).toContain('999,999.99')
  })

  test('currency parameter is case-insensitive', () => {
    const upper = formatAmount(1000, 'USD')
    const lower = formatAmount(1000, 'usd')
    expect(upper).toBe(lower)
  })
})

// ============================================================================
// Roundtrip: toCents <-> toDollars
// ============================================================================

describe('Payments - toCents/toDollars roundtrip', () => {
  test('toDollars(toCents(x)) == x for whole dollars', () => {
    expect(toDollars(toCents(10))).toBe(10)
    expect(toDollars(toCents(99))).toBe(99)
    expect(toDollars(toCents(0))).toBe(0)
  })

  test('toDollars(toCents(x)) == x for common prices', () => {
    expect(toDollars(toCents(9.99))).toBe(9.99)
    expect(toDollars(toCents(19.95))).toBe(19.95)
    expect(toDollars(toCents(0.01))).toBe(0.01)
  })

  test('toCents(toDollars(x)) == x for integer cents', () => {
    expect(toCents(toDollars(100))).toBe(100)
    expect(toCents(toDollars(999))).toBe(999)
    expect(toCents(toDollars(1))).toBe(1)
  })
})

// ============================================================================
// Named Export Verification - All payment functions exist and are callable
// ============================================================================

describe('Payments - Named Exports Are Functions', () => {
  // Core payment operations
  test('charge is a function', () => expect(typeof charge).toBe('function'))
  test('createPayment is a function', () => expect(typeof createPayment).toBe('function'))
  test('refund is a function', () => expect(typeof refund).toBe('function'))
  test('checkout is a function', () => expect(typeof checkout).toBe('function'))
  test('subscriptionCheckout is a function', () => expect(typeof subscriptionCheckout).toBe('function'))

  // Subscription operations
  test('subscribe is a function', () => expect(typeof subscribe).toBe('function'))
  test('cancelSubscription is a function', () => expect(typeof cancelSubscription).toBe('function'))
  test('hasActiveSubscription is a function', () => expect(typeof hasActiveSubscription).toBe('function'))
  test('changeSubscription is a function', () => expect(typeof changeSubscription).toBe('function'))

  // Customer operations
  test('getOrCreateCustomer is a function', () => expect(typeof getOrCreateCustomer).toBe('function'))
  test('updateCustomer is a function', () => expect(typeof updateCustomer).toBe('function'))
  test('deleteCustomer is a function', () => expect(typeof deleteCustomer).toBe('function'))

  // Payment method operations
  test('addPaymentMethod is a function', () => expect(typeof addPaymentMethod).toBe('function'))
  test('setDefaultPaymentMethod is a function', () => expect(typeof setDefaultPaymentMethod).toBe('function'))
  test('removePaymentMethod is a function', () => expect(typeof removePaymentMethod).toBe('function'))
  test('createSetupIntent is a function', () => expect(typeof createSetupIntent).toBe('function'))

  // Invoice operations
  test('getInvoices is a function', () => expect(typeof getInvoices).toBe('function'))
  test('createInvoice is a function', () => expect(typeof createInvoice).toBe('function'))
  test('payInvoice is a function', () => expect(typeof payInvoice).toBe('function'))

  // Product/price operations
  test('createProduct is a function', () => expect(typeof createProduct).toBe('function'))
  test('getPrice is a function', () => expect(typeof getPrice).toBe('function'))
  test('listProducts is a function', () => expect(typeof listProducts).toBe('function'))

  // Coupon operations
  test('createCoupon is a function', () => expect(typeof createCoupon).toBe('function'))
  test('createPromoCode is a function', () => expect(typeof createPromoCode).toBe('function'))
  test('validatePromoCode is a function', () => expect(typeof validatePromoCode).toBe('function'))

  // Utility functions
  test('formatAmount is a function', () => expect(typeof formatAmount).toBe('function'))
  test('toCents is a function', () => expect(typeof toCents).toBe('function'))
  test('toDollars is a function', () => expect(typeof toDollars).toBe('function'))
})

// ============================================================================
// Payment Facade Object - Shape and structure
// ============================================================================

describe('Payments - Payment Facade Object Shape', () => {
  test('Payment object exposes core payment methods', () => {
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

  test('Payment object exposes payment method methods', () => {
    expect(typeof Payment.addPaymentMethod).toBe('function')
    expect(typeof Payment.setDefaultPaymentMethod).toBe('function')
    expect(typeof Payment.removePaymentMethod).toBe('function')
    expect(typeof Payment.createSetupIntent).toBe('function')
  })

  test('Payment object exposes invoice methods', () => {
    expect(typeof Payment.getInvoices).toBe('function')
    expect(typeof Payment.createInvoice).toBe('function')
    expect(typeof Payment.payInvoice).toBe('function')
  })

  test('Payment object exposes product/price/coupon methods', () => {
    expect(typeof Payment.createProduct).toBe('function')
    expect(typeof Payment.getPrice).toBe('function')
    expect(typeof Payment.listProducts).toBe('function')
    expect(typeof Payment.createCoupon).toBe('function')
    expect(typeof Payment.createPromoCode).toBe('function')
    expect(typeof Payment.validatePromoCode).toBe('function')
  })

  test('Payment object exposes utility methods', () => {
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

  test('Payment facade methods are the same references as named exports', () => {
    expect(Payment.charge).toBe(charge)
    expect(Payment.refund).toBe(refund)
    expect(Payment.subscribe).toBe(subscribe)
    expect(Payment.cancelSubscription).toBe(cancelSubscription)
    expect(Payment.formatAmount).toBe(formatAmount)
    expect(Payment.toCents).toBe(toCents)
    expect(Payment.toDollars).toBe(toDollars)
    expect(Payment.getOrCreateCustomer).toBe(getOrCreateCustomer)
    expect(Payment.updateCustomer).toBe(updateCustomer)
    expect(Payment.deleteCustomer).toBe(deleteCustomer)
  })
})
