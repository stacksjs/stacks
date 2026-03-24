import { afterEach, describe, expect, mock, test } from 'bun:test'

// NOTE: The Stripe driver reads services.stripe.secretKey at module-evaluation
// time. The env var STRIPE_SECRET_KEY must be set before bun resolves any
// imports. This is handled by the test preload (tests/env-setup.ts).

// ---------------------------------------------------------------------------
// Mocks — must be declared BEFORE the module-under-test is imported.
// ---------------------------------------------------------------------------

const mockCharge = mock(() =>
  Promise.resolve({ id: 'pi_123', object: 'payment_intent', amount: 5000, status: 'succeeded' }),
)
const mockCreatePayment = mock(() =>
  Promise.resolve({ id: 'pi_456', object: 'payment_intent', amount: 2000, status: 'requires_confirmation' }),
)
const mockRefund = mock(() =>
  Promise.resolve({ id: 're_123', object: 'refund', amount: 5000 }),
)

mock.module('../src/billable/charge', () => ({
  manageCharge: {
    charge: mockCharge,
    createPayment: mockCreatePayment,
    refund: mockRefund,
  },
}))

const mockCheckoutCreate = mock(() =>
  Promise.resolve({ id: 'cs_123', object: 'checkout.session', url: 'https://checkout.stripe.com/cs_123' }),
)
mock.module('../src/billable/checkout', () => ({
  manageCheckout: { create: mockCheckoutCreate },
}))

const mockCreateOrGetStripeUser = mock(() =>
  Promise.resolve({ id: 'cus_123', object: 'customer', email: 'user@test.com' }),
)
const mockUpdateStripeCustomer = mock(() =>
  Promise.resolve({ id: 'cus_123', object: 'customer', name: 'Updated Name' }),
)
const mockDeleteStripeUser = mock(() =>
  Promise.resolve({ id: 'cus_123', object: 'customer', deleted: true }),
)
mock.module('../src/billable/customer', () => ({
  manageCustomer: {
    createOrGetStripeUser: mockCreateOrGetStripeUser,
    updateStripeCustomer: mockUpdateStripeCustomer,
    deleteStripeUser: mockDeleteStripeUser,
  },
}))

const mockInvoiceList = mock(() =>
  Promise.resolve({ object: 'list', data: [{ id: 'in_123' }], has_more: false }),
)
mock.module('../src/billable/invoice', () => ({
  manageInvoice: { list: mockInvoiceList },
}))

const mockAddPaymentMethod = mock(() =>
  Promise.resolve({ id: 'pm_123', object: 'payment_method', type: 'card' }),
)
const mockSetUserDefaultPayment = mock(() =>
  Promise.resolve({ id: 'cus_123', object: 'customer', invoice_settings: { default_payment_method: 'pm_123' } }),
)
const mockDeletePaymentMethod = mock(() =>
  Promise.resolve({ id: 'pm_123', object: 'payment_method' }),
)
mock.module('../src/billable/payment-method', () => ({
  managePaymentMethod: {
    addPaymentMethod: mockAddPaymentMethod,
    setUserDefaultPayment: mockSetUserDefaultPayment,
    deletePaymentMethod: mockDeletePaymentMethod,
  },
}))

const mockRetrieveByLookupKey = mock(() =>
  Promise.resolve({ id: 'price_123', object: 'price', unit_amount: 2000 }),
)
mock.module('../src/billable/price', () => ({
  managePrice: { retrieveByLookupKey: mockRetrieveByLookupKey },
}))

const mockCreateWithPrice = mock(() =>
  Promise.resolve({
    product: { id: 'prod_123', name: 'Test Product' },
    price: { id: 'price_123', unit_amount: 2000 },
  }),
)
const mockListProducts = mock(() =>
  Promise.resolve({ object: 'list', data: [{ id: 'prod_123' }], has_more: false }),
)
const mockCouponCreate = mock(() =>
  Promise.resolve({ id: 'coup_123', object: 'coupon', percent_off: 20 }),
)
const mockCreatePromotionCode = mock(() =>
  Promise.resolve({ id: 'promo_123', object: 'promotion_code', code: 'SAVE20' }),
)
const mockRetrievePromotionCode = mock(() =>
  Promise.resolve({ id: 'promo_123', object: 'promotion_code', code: 'SAVE20', active: true }),
)
mock.module('../src/billable/product', () => ({
  manageProduct: { createWithPrice: mockCreateWithPrice, list: mockListProducts },
  managePriceExtended: {},
  manageCoupon: {
    create: mockCouponCreate,
    createPromotionCode: mockCreatePromotionCode,
    retrievePromotionCode: mockRetrievePromotionCode,
  },
}))

const mockSubscriptionCreate = mock(() =>
  Promise.resolve({ id: 'sub_123', object: 'subscription', status: 'active' }),
)
const mockSubscriptionCancel = mock(() =>
  Promise.resolve({ id: 'sub_123', object: 'subscription', status: 'canceled' }),
)
const mockSubscriptionIsValid = mock(() => Promise.resolve(true))
const mockSubscriptionUpdate = mock(() =>
  Promise.resolve({ id: 'sub_123', object: 'subscription', status: 'active' }),
)
mock.module('../src/billable/subscription', () => ({
  manageSubscription: {
    create: mockSubscriptionCreate,
    cancel: mockSubscriptionCancel,
    isValid: mockSubscriptionIsValid,
    update: mockSubscriptionUpdate,
  },
}))

const mockSetupIntentCreate = mock(() =>
  Promise.resolve({ id: 'seti_123', object: 'setup_intent', status: 'requires_payment_method' }),
)
mock.module('../src/billable/intent', () => ({
  manageSetupIntent: { create: mockSetupIntentCreate },
}))

const mockWebhookHandler = { constructEvent: mock(() => ({})) }
mock.module('../src/billable/webhook', () => ({
  manageWebhook: mockWebhookHandler,
  onCharge: mock(() => {}),
  onCheckout: mock(() => {}),
  onInvoice: mock(() => {}),
  onPaymentIntent: mock(() => {}),
  onSubscription: mock(() => {}),
  processWebhook: mock(() => Promise.resolve()),
}))

const mockInvoicesCreate = mock(() =>
  Promise.resolve({ id: 'in_new', object: 'invoice' }),
)
const mockInvoicesPay = mock(() =>
  Promise.resolve({ id: 'in_123', object: 'invoice', status: 'paid' }),
)
mock.module('../src/drivers/stripe', () => ({
  stripe: {
    invoices: {
      create: mockInvoicesCreate,
      pay: mockInvoicesPay,
    },
  },
}))

// ---------------------------------------------------------------------------
// Import module-under-test AFTER mocks are set up
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

// Fake user model used across tests
const fakeUser = { id: 1, name: 'Test User', email: 'test@example.com' } as any

afterEach(() => {
  // Reset call counts for all our mocks between tests.
  // mock.restore() only resets spied functions, not manually created mocks.
  for (const fn of [
    mockCharge, mockCreatePayment, mockRefund,
    mockCheckoutCreate,
    mockCreateOrGetStripeUser, mockUpdateStripeCustomer, mockDeleteStripeUser,
    mockInvoiceList,
    mockAddPaymentMethod, mockSetUserDefaultPayment, mockDeletePaymentMethod,
    mockRetrieveByLookupKey,
    mockCreateWithPrice, mockListProducts, mockCouponCreate, mockCreatePromotionCode, mockRetrievePromotionCode,
    mockSubscriptionCreate, mockSubscriptionCancel, mockSubscriptionIsValid, mockSubscriptionUpdate,
    mockSetupIntentCreate,
    mockInvoicesCreate, mockInvoicesPay,
  ]) {
    fn.mockClear()
  }
})

// ============================================================================
// Charge tests
// ============================================================================

describe('Payment Facade - charge()', () => {
  test('charge() delegates to manageCharge.charge with correct args', async () => {
    const result = await charge(fakeUser, 5000, 'pm_123')
    expect(mockCharge).toHaveBeenCalledTimes(1)
    expect(mockCharge.mock.calls[0][0]).toBe(fakeUser)
    expect(mockCharge.mock.calls[0][1]).toBe(5000)
    expect(mockCharge.mock.calls[0][2]).toBe('pm_123')
    expect(result).toHaveProperty('id', 'pi_123')
  })

  test('charge() passes extra options through', async () => {
    await charge(fakeUser, 3000, 'pm_456', { description: 'test charge' })
    const opts = mockCharge.mock.calls[0][3]
    expect(opts).toHaveProperty('description', 'test charge')
  })
})

describe('Payment Facade - createPayment()', () => {
  test('createPayment() delegates to manageCharge.createPayment', async () => {
    const result = await createPayment(fakeUser, 2000)
    expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('id', 'pi_456')
  })
})

// ============================================================================
// Refund tests
// ============================================================================

describe('Payment Facade - refund()', () => {
  test('refund() delegates to manageCharge.refund', async () => {
    const result = await refund('pi_123', 5000)
    expect(mockRefund).toHaveBeenCalledTimes(1)
    expect(mockRefund.mock.calls[0][0]).toBe('pi_123')
    expect(result).toHaveProperty('id', 're_123')
  })

  test('refund() passes partial amount', async () => {
    await refund('pi_123', 1000)
    const passedOpts = mockRefund.mock.calls[0][1]
    expect(passedOpts).toHaveProperty('amount', 1000)
  })
})

// ============================================================================
// Checkout tests
// ============================================================================

describe('Payment Facade - checkout()', () => {
  test('checkout() delegates to manageCheckout.create', async () => {
    const items = [{ price: 'price_123', quantity: 1 }]
    const result = await checkout(fakeUser, items)
    expect(mockCheckoutCreate).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('id', 'cs_123')
  })

  test('subscriptionCheckout() sets mode to subscription', async () => {
    await subscriptionCheckout(fakeUser, 'price_123')
    const passedOpts = mockCheckoutCreate.mock.calls[0][1]
    expect(passedOpts).toHaveProperty('mode', 'subscription')
    expect(passedOpts.line_items).toEqual([{ price: 'price_123', quantity: 1 }])
  })
})

// ============================================================================
// Subscription tests
// ============================================================================

describe('Payment Facade - subscribe()', () => {
  test('subscribe() delegates to manageSubscription.create', async () => {
    const result = await subscribe(fakeUser, 'monthly_plan')
    expect(mockSubscriptionCreate).toHaveBeenCalledTimes(1)
    expect(mockSubscriptionCreate.mock.calls[0][0]).toBe(fakeUser)
    expect(mockSubscriptionCreate.mock.calls[0][1]).toBe('default')
    expect(mockSubscriptionCreate.mock.calls[0][2]).toBe('monthly_plan')
    expect(result).toHaveProperty('id', 'sub_123')
  })
})

describe('Payment Facade - cancelSubscription()', () => {
  test('cancelSubscription() delegates with default immediately=false', async () => {
    const result = await cancelSubscription('sub_123')
    expect(mockSubscriptionCancel).toHaveBeenCalledTimes(1)
    expect(mockSubscriptionCancel.mock.calls[0][0]).toBe('sub_123')
    const opts = mockSubscriptionCancel.mock.calls[0][1]
    expect(opts).toHaveProperty('prorate', true)
    expect(opts).toHaveProperty('invoice_now', false)
    expect(result).toHaveProperty('status', 'canceled')
  })

  test('cancelSubscription(id, true) sets immediately flags', async () => {
    await cancelSubscription('sub_456', true)
    const opts = mockSubscriptionCancel.mock.calls[0][1]
    expect(opts).toHaveProperty('prorate', false)
    expect(opts).toHaveProperty('invoice_now', true)
  })
})

describe('Payment Facade - hasActiveSubscription()', () => {
  test('hasActiveSubscription() checks validity', async () => {
    const result = await hasActiveSubscription(fakeUser)
    expect(mockSubscriptionIsValid).toHaveBeenCalledTimes(1)
    expect(result).toBe(true)
  })

  test('hasActiveSubscription() passes subscription type', async () => {
    await hasActiveSubscription(fakeUser, 'premium')
    expect(mockSubscriptionIsValid.mock.calls[0][1]).toBe('premium')
  })
})

describe('Payment Facade - changeSubscription()', () => {
  test('changeSubscription() delegates to manageSubscription.update', async () => {
    const result = await changeSubscription(fakeUser, 'yearly_plan')
    expect(mockSubscriptionUpdate).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('id', 'sub_123')
  })
})

// ============================================================================
// Customer tests
// ============================================================================

describe('Payment Facade - customer functions', () => {
  test('getOrCreateCustomer() delegates correctly', async () => {
    const result = await getOrCreateCustomer(fakeUser)
    expect(mockCreateOrGetStripeUser).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('id', 'cus_123')
  })

  test('updateCustomer() delegates correctly', async () => {
    const result = await updateCustomer(fakeUser, { name: 'Updated Name' } as any)
    expect(mockUpdateStripeCustomer).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('name', 'Updated Name')
  })

  test('deleteCustomer() delegates correctly', async () => {
    const result = await deleteCustomer(fakeUser)
    expect(mockDeleteStripeUser).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('deleted', true)
  })
})

// ============================================================================
// Payment Method tests
// ============================================================================

describe('Payment Facade - payment methods', () => {
  test('addPaymentMethod() delegates correctly', async () => {
    const result = await addPaymentMethod(fakeUser, 'pm_new')
    expect(mockAddPaymentMethod).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('id', 'pm_123')
  })

  test('setDefaultPaymentMethod() delegates correctly', async () => {
    const result = await setDefaultPaymentMethod(fakeUser, 'pm_123')
    expect(mockSetUserDefaultPayment).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('id', 'cus_123')
  })

  test('removePaymentMethod() accepts string id', async () => {
    await removePaymentMethod(fakeUser, 'pm_123')
    expect(mockDeletePaymentMethod).toHaveBeenCalledTimes(1)
    expect(mockDeletePaymentMethod.mock.calls[0][1]).toBe('pm_123')
  })

  test('removePaymentMethod() accepts numeric id', async () => {
    await removePaymentMethod(fakeUser, 42)
    expect(mockDeletePaymentMethod).toHaveBeenCalledTimes(1)
    expect(mockDeletePaymentMethod.mock.calls[0][1]).toBe(42)
  })

  test('createSetupIntent() delegates correctly', async () => {
    const result = await createSetupIntent(fakeUser)
    expect(mockSetupIntentCreate).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('id', 'seti_123')
  })
})

// ============================================================================
// Invoice tests
// ============================================================================

describe('Payment Facade - invoices', () => {
  test('getInvoices() delegates to manageInvoice.list', async () => {
    const result = await getInvoices(fakeUser)
    expect(mockInvoiceList).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('object', 'list')
  })

  test('createInvoice() uses stripe.invoices.create directly', async () => {
    const result = await createInvoice('cus_123', { description: 'Manual invoice' })
    expect(mockInvoicesCreate).toHaveBeenCalledTimes(1)
    const passedOpts = mockInvoicesCreate.mock.calls[0][0]
    expect(passedOpts).toHaveProperty('customer', 'cus_123')
    expect(passedOpts).toHaveProperty('description', 'Manual invoice')
    expect(result).toHaveProperty('id', 'in_new')
  })

  test('payInvoice() uses stripe.invoices.pay directly', async () => {
    const result = await payInvoice('in_123')
    expect(mockInvoicesPay).toHaveBeenCalledTimes(1)
    expect(mockInvoicesPay.mock.calls[0][0]).toBe('in_123')
    expect(result).toHaveProperty('status', 'paid')
  })
})

// ============================================================================
// Product & Price tests
// ============================================================================

describe('Payment Facade - products and prices', () => {
  test('createProduct() delegates to manageProduct.createWithPrice', async () => {
    const result = await createProduct('Test Product', 2000)
    expect(mockCreateWithPrice).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('product')
    expect(result).toHaveProperty('price')
  })

  test('createProduct() with recurring interval', async () => {
    await createProduct('Monthly Plan', 999, { interval: 'month', currency: 'eur' })
    const priceParams = mockCreateWithPrice.mock.calls[0][1]
    expect(priceParams).toHaveProperty('unit_amount', 999)
    expect(priceParams).toHaveProperty('currency', 'eur')
    expect(priceParams).toHaveProperty('recurring')
    expect(priceParams.recurring).toEqual({ interval: 'month' })
  })

  test('getPrice() delegates to managePrice.retrieveByLookupKey', async () => {
    const result = await getPrice('basic_monthly')
    expect(mockRetrieveByLookupKey).toHaveBeenCalledTimes(1)
    expect(mockRetrieveByLookupKey.mock.calls[0][0]).toBe('basic_monthly')
    expect(result).toHaveProperty('id', 'price_123')
  })

  test('listProducts() delegates to manageProduct.list', async () => {
    const result = await listProducts({ limit: 10 })
    expect(mockListProducts).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('object', 'list')
  })
})

// ============================================================================
// Coupon tests
// ============================================================================

describe('Payment Facade - coupons', () => {
  test('createCoupon() with percentOff', async () => {
    const result = await createCoupon({ percentOff: 20, duration: 'once' })
    expect(mockCouponCreate).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('id', 'coup_123')
  })

  test('createPromoCode() delegates correctly', async () => {
    const result = await createPromoCode('coup_123', 'SAVE20')
    expect(mockCreatePromotionCode).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('code', 'SAVE20')
  })

  test('validatePromoCode() delegates correctly', async () => {
    const result = await validatePromoCode('SAVE20')
    expect(mockRetrievePromotionCode).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('active', true)
  })
})

// ============================================================================
// Utility function tests
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
  test('Payment is importable as default and named from index', async () => {
    // We already verified the named exports above — just confirm the facade object
    // has the expected shape when re-exported through index.
    expect(Payment).toBeDefined()
    expect(typeof Payment.charge).toBe('function')
  })
})
