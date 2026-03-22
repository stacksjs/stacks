---
name: stacks-payments
description: Use when implementing payment processing in Stacks — Stripe charges, subscriptions, checkout sessions, customer management, payment methods, invoices, coupons, promo codes, products, prices, webhooks, or the Payment facade. Covers @stacksjs/payments and config/payment.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Payments

Full Stripe integration via the Payment facade. Uses Stripe API version `2026-01-28.clover`. The Stripe SDK is initialized from `services.stripe.secretKey` (sourced from `config/payment.ts`).

## Key Paths
- Core package: `storage/framework/core/payments/src/`
- Payment facade: `storage/framework/core/payments/src/payment.ts`
- Stripe driver: `storage/framework/core/payments/src/drivers/stripe.ts`
- Billable modules: `storage/framework/core/payments/src/billable/`
- Configuration: `config/payment.ts`
- SaaS config: `config/saas.ts`
- Default billing functions: `storage/framework/defaults/functions/billing/payments.ts`

## Package Exports
- `Payment` (default) -- facade object with all payment methods
- All individual functions (`charge`, `subscribe`, `checkout`, etc.)
- All billable modules (`manageCharge`, `manageCustomer`, `manageSubscription`, etc.)
- `stripe` -- raw Stripe SDK instance
- `Stripe` -- re-exported Stripe types namespace

## Payment Facade

The `Payment` object aggregates all payment operations. Every method is also available as a standalone export.

### Charges

```typescript
import { Payment } from '@stacksjs/payments'

// Create and confirm a charge (creates PaymentIntent with confirm: true)
const intent = await Payment.charge(user, 2999, 'pm_xxx', { currency: 'usd' })

// Create PaymentIntent without confirming (for client-side confirmation)
const intent = await Payment.createPayment(user, 2999, { currency: 'usd' })

// Refund -- partial
const refund = await Payment.refund('pi_xxx', 1000)

// Refund -- full (omit amount)
const refund = await Payment.refund('pi_xxx')
```

`charge()` sets `confirmation_method: 'automatic'`, `confirm: true`, attaches the payment method, and delegates to `createPayment()`. If the user has a `stripe_id`, it is set as the customer on the PaymentIntent. Default currency is `'usd'`.

The `manageCharge` module also exposes `findPayment(id)` which retrieves a PaymentIntent by ID, returning `null` on failure.

### Checkout Sessions

```typescript
// One-time payment checkout
const session = await Payment.checkout(user, [
  { price: 'price_xxx', quantity: 1 }
], { success_url: '/success', cancel_url: '/cancel' })

// Subscription checkout
const subSession = await Payment.subscriptionCheckout(user, 'price_xxx', {
  success_url: '/success', cancel_url: '/cancel'
})
```

Both methods require the user to have a `stripe_id` (throws if missing). `checkout()` sets `mode: 'payment'`, `subscriptionCheckout()` sets `mode: 'subscription'`.

### Subscriptions

```typescript
// Create -- uses lookup_key to resolve the Stripe Price
const sub = await Payment.subscribe(user, 'premium-monthly')

// Cancel at period end (prorate: true)
const cancelled = await Payment.cancelSubscription('sub_xxx')

// Cancel immediately (invoice_now: true, prorate: false)
const cancelled = await Payment.cancelSubscription('sub_xxx', true)

// Check active subscription
const hasActive = await Payment.hasActiveSubscription(user, 'default')

// Change plan -- swaps the subscription item's price
const changed = await Payment.changeSubscription(user, 'enterprise-monthly')
```

`subscribe()` calls `managePrice.retrieveByLookupKey(lookupKey)` to find the price, then creates the subscription with `payment_behavior: 'allow_incomplete'` and `expand: ['latest_invoice.payment_intent']`. It stores the subscription in the `subscriptions` database table.

`isValid()` returns `true` if the subscription status is `'active'` or `'trialing'`. `isIncomplete()` checks for `'incomplete'` status.

`cancel()` calls `stripe.subscriptions.cancel()` and updates `provider_status` to `'canceled'` in the database.

`update()` retrieves the active subscription via `user.activeSubscription()`, finds the new price by lookup key, updates the subscription item, and stores the updated price in the database.

### Customers

```typescript
// Get existing or create new Stripe customer
const customer = await Payment.getOrCreateCustomer(user, { name: 'John' })

// Update customer details in Stripe
const updated = await Payment.updateCustomer(user, { name: 'Jane' })

// Delete from Stripe and clear stripe_id on user model
const deleted = await Payment.deleteCustomer(user)
```

`createOrGetStripeUser()` checks `user.stripe_id` first. If the user has one, it retrieves the customer from Stripe. If the customer was deleted (404 or `deleted: true`), it creates a new one. On creation, it auto-fills `name` and `email` from the user model and calls `user.update({ stripe_id: customer.id })`.

Additional methods on `manageCustomer`:
- `stripeId(user)` -- returns `user.stripe_id`
- `hasStripeId(user)` -- boolean check
- `createStripeCustomer(user, options)` -- throws if user already has a stripe_id
- `createOrUpdateStripeUser(user, options)` -- creates or updates
- `retrieveStripeUser(user)` -- returns customer or undefined
- `syncStripeCustomerDetails(user, options)` -- updates Stripe with user's name, email, address, locales, metadata

### Payment Methods

```typescript
// Add a payment method to the customer
const pm = await Payment.addPaymentMethod(user, 'pm_xxx')

// Set as default (by Stripe payment method ID string)
const customer = await Payment.setDefaultPaymentMethod(user, 'pm_xxx')

// Remove a payment method (by database record ID number)
const removed = await Payment.removePaymentMethod(user, paymentMethodDbId)

// Create a setup intent for collecting payment methods
const intent = await Payment.createSetupIntent(user, { payment_method_types: ['card'] })
```

`addPaymentMethod()` accepts a string (Stripe PM ID) or Stripe.PaymentMethod object. It attaches the PM to the customer if not already attached, then stores it in the `payment_methods` table with `type`, `last_four`, `brand`, `exp_year`, `exp_month`, `user_id`, `provider_id`.

`setUserDefaultPayment()` accepts a Stripe PM ID string, clears existing `is_default` flags, sets the new default in the database, and updates `invoice_settings.default_payment_method` on the Stripe customer.

`setDefaultPaymentMethod()` accepts a database record ID number.

Additional methods on `managePaymentMethod`:
- `updatePaymentMethod(user, pmId, params)` -- updates PM in Stripe
- `listPaymentMethods(user)` -- queries `payment_methods` table by `user_id`
- `retrievePaymentMethod(user, pmId)` -- by database ID
- `retrieveDefaultPaymentMethod(user)` -- finds where `is_default: true`

### Invoices

```typescript
const invoices = await Payment.getInvoices(user)  // lists with expanded payment_intent.payment_method
const invoice = await Payment.createInvoice('cus_xxx', { description: 'Custom invoice' })
const paid = await Payment.payInvoice('inv_xxx')
```

`getInvoices()` requires the user to have a `stripe_id` and expands `data.payment_intent.payment_method`.

### Products & Prices

```typescript
// Create a product with its price
const { product, price } = await Payment.createProduct('Pro Plan', 2999, {
  currency: 'usd', interval: 'month', description: 'Pro features'
})

// Get a price by Stripe lookup_key
const price = await Payment.getPrice('premium-monthly')

// List active products
const products = await Payment.listProducts({ limit: 10 })
```

`createProduct()` creates the Stripe product, then creates a price linked to it. If `interval` is provided, the price gets `recurring: { interval }`.

Additional methods on `manageProduct`:
- `create(params)`, `retrieve(productId)`, `update(productId, params)`
- `archive(productId)` -- sets `active: false`
- `search(query, params)` -- Stripe product search
- `list(params)` -- defaults to `active: true`

Additional methods on `managePriceExtended`:
- `create(params)`, `retrieve(priceId)`, `update(priceId, params)`
- `list(params)` -- defaults to `active: true`
- `listByProduct(productId, params)` -- prices for a specific product
- `search(query, params)` -- Stripe price search
- `archive(priceId)` -- sets `active: false`

### Coupons & Promo Codes

```typescript
const coupon = await Payment.createCoupon({
  percentOff: 20, duration: 'once', name: 'Holiday Sale', maxRedemptions: 100
})

// Or amount-based: { amountOff: 500, currency: 'usd', duration: 'forever' }

const promo = await Payment.createPromoCode('coupon_xxx', 'SAVE20')
const valid = await Payment.validatePromoCode('SAVE20')  // returns PromotionCode | null
```

`createCoupon()` supports `percentOff`, `amountOff`, `currency`, `duration` ('forever' | 'once' | 'repeating'), `durationInMonths`, `name`, `maxRedemptions`.

Additional methods on `manageCoupon`:
- `retrieve(couponId)`, `update(couponId, params)`, `delete(couponId)`, `list(params)`
- `createPromotionCode(params)` -- wraps `stripe.promotionCodes.create()`
- `retrievePromotionCode(code)` -- lists active promotion codes matching the code string

### Transactions

```typescript
import { manageTransaction } from '@stacksjs/payments'

const tx = await manageTransaction.store(user, productId, {
  brand: 'visa', provider_id: 'pi_xxx', description: 'Purchase', type: 'one-time'
})
const txList = await manageTransaction.list(user)
```

Transactions are stored in the `payment_transactions` table with `name` (from product), `amount` (from product `unit_price`), `brand`, `type`, `provider_id`, `user_id`.

### Webhooks

```typescript
import { Payment } from '@stacksjs/payments'

// Register handlers
Payment.onPaymentIntent({
  succeeded: async (event) => { /* ... */ },
  failed: async (event) => { /* ... */ },
  created: async (event) => { /* ... */ },
  canceled: async (event) => { /* ... */ },
})

Payment.onSubscription({
  created: async (event) => { /* ... */ },
  updated: async (event) => { /* ... */ },
  deleted: async (event) => { /* ... */ },
  trialWillEnd: async (event) => { /* ... */ },
})

Payment.onInvoice({
  paid: async (event) => { /* ... */ },
  paymentFailed: async (event) => { /* ... */ },
  created: async (event) => { /* ... */ },
  finalized: async (event) => { /* ... */ },
})

Payment.onCheckout({
  completed: async (event) => { /* ... */ },
  expired: async (event) => { /* ... */ },
})

Payment.onCharge({
  succeeded: async (event) => { /* ... */ },
  failed: async (event) => { /* ... */ },
  refunded: async (event) => { /* ... */ },
  disputed: async (event) => { /* ... */ },
})

// Process incoming webhook request
const result = await Payment.processWebhook(rawPayload, signatureHeader, {
  secret: 'whsec_xxx', tolerance: 300
})
// Returns: { success: boolean, eventType?: string, error?: string }

// Low-level: register any event type
Payment.webhook.onWebhookEvent('payment_method.attached', handler)
Payment.webhook.registerWebhookHandlers({ 'payment_intent.succeeded': handler })

// Event data extractors
import { getPaymentIntent, getSubscription, getInvoice, getCheckoutSession, getCharge, getCustomer } from '@stacksjs/payments'
```

Supported webhook event types: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.created`, `payment_intent.canceled`, `customer.subscription.created/updated/deleted`, `customer.subscription.trial_will_end`, `customer.created/updated/deleted`, `invoice.paid/payment_failed/finalized/created`, `checkout.session.completed/expired`, `charge.succeeded/failed/refunded`, `charge.dispute.created/closed`, `payment_method.attached/detached`, `setup_intent.succeeded/setup_failed`, plus any string.

### Setup Products from SaaS Config

```typescript
import { createStripeProduct } from '@stacksjs/payments'

const result = await createStripeProduct()
// Creates Stripe products and prices from config/saas.ts plans
```

This iterates `saas.plans`, creates a Stripe product per plan, then creates prices for each pricing option using `lookup_key` from the `key` field.

### Utility Functions

```typescript
Payment.formatAmount(2999, 'usd')   // '$29.99' (uses Intl.NumberFormat)
Payment.toCents(29.99)               // 2999
Payment.toDollars(2999)              // 29.99
```

### Client-Side Billing (useBillable)

The `storage/framework/defaults/functions/billing/payments.ts` file provides a `useBillable()` composable for frontend billing UI:

```typescript
const { loadCardForm, loadPaymentForm, handleAddPaymentMethod, handlePayment } = useBillable()

await loadCardForm(clientSecret)      // loads Stripe Card Element
await loadPaymentForm(clientSecret)   // loads Stripe Payment Element
await handleAddPaymentMethod(clientSecret, elements)  // confirms card setup
await handlePayment(elements)         // confirms payment
```

## config/payment.ts

```typescript
{
  driver: 'stripe',
  stripe: {
    publishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
    secretKey: env.STRIPE_SECRET_KEY || '',
  },
} satisfies PaymentConfig
```

## config/saas.ts

Plans use `productName`, `description`, `metadata`, and a `pricing` array where each entry has `key` (lookup_key), `price` (in cents), `interval` (optional: 'month' | 'year'), `currency`:

```typescript
{
  plans: [
    {
      productName: 'Stacks Hobby',
      description: 'All the Stacks features.',
      pricing: [
        { key: 'stacks_hobby_early_monthly', price: 1900, interval: 'month', currency: 'usd' },
        { key: 'stacks_hobby_yearly', price: 37900, interval: 'year', currency: 'usd' },
      ],
      metadata: { createdBy: 'admin', version: '1.0.0' },
    },
    // ... more plans
  ],
  webhook: { endpoint: 'your-webhook-endpoint', secret: 'your-webhook-secret' },
  currencies: ['usd'],
  coupons: [],
  products: [
    { name: 'Stacks Hobby', description: '...', images: ['image-url'] },
  ],
} satisfies SaasConfig
```

## Database Tables Used
- `subscriptions` -- columns: `user_id`, `type`, `unit_price`, `provider_id`, `provider_status`, `provider_price_id`, `quantity`, `trial_ends_at`, `ends_at`, `provider_type`, `last_used_at`
- `payment_methods` -- columns: `id`, `type`, `last_four`, `brand`, `exp_year`, `exp_month`, `user_id`, `provider_id`, `is_default`
- `payment_products` -- columns: `id`, `name`, `unit_price`
- `payment_transactions` -- columns: `id`, `name`, `description`, `amount`, `brand`, `type`, `provider_id`, `user_id`

## User Model Requirements
The `UserModel` must have:
- `id`, `name`, `email`, `stripe_id` fields
- `hasStripeId()` method -- returns boolean
- `update(data)` method -- for persisting `stripe_id`
- `activeSubscription()` method -- for subscription updates

## Gotchas
- Stripe API keys MUST be in `.env` as `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` -- never hardcode them in config files
- The Stripe SDK is initialized eagerly -- if `STRIPE_SECRET_KEY` is missing, the module throws on import
- All amounts are in cents -- use `toCents()` and `toDollars()` for conversion
- `charge()` creates AND confirms the PaymentIntent in one step
- `subscribe()` resolves the price via `lookup_key`, not a direct Stripe price ID
- `removePaymentMethod()` takes a database record ID (number), not a Stripe PM ID (string)
- `setDefaultPaymentMethod` has two variants: one takes a Stripe PM ID string (`setUserDefaultPayment`), the other takes a database ID number
- `getOrCreateCustomer()` handles deleted Stripe customers by recreating them
- Subscription status checks query the local database, not Stripe directly
- `list()` on products defaults to `active: true` only
- Webhook handlers are stored in an in-memory Map -- register them on application startup
- `processWebhook()` uses `stripe.webhooks.constructEvent()` for signature verification
