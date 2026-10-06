---
title: Payments Package
description: "provides Stripe customers, payment intents, checkout sessions, subscriptions, payment methods, invoices, products, prices, coupons, transactions, and signe..."
---
# Payments

`@stacksjs/payments` provides Stripe customers, payment intents, checkout sessions, subscriptions, payment methods, invoices, products, prices, coupons, transactions, and signed webhooks.

## Payment drivers

`paymentDriver()` returns the provider `config.payment.driver` names, `stripe` unless it says otherwise. Every driver speaks the same terms: money as `{ amount, currency }` in minor units, payment statuses of our own (`succeeded`, `processing`, `requires_action`, `requires_payment_method`, `failed`, `canceled`), and webhook events of our own (`payment.succeeded`, `refund.succeeded`, `checkout.completed`, ...).

```ts
import { paymentDriver } from '@stacksjs/payments'

const payments = paymentDriver()

const result = await payments.charge(user, { amount: 2999, currency: 'eur' }, storedCardId, {
  reference: `order-${order.id}`,
  idempotencyKey: `order-${order.id}`,
})
if (result.status === 'requires_action')
  return { redirect: result.redirectUrl }

const session = await payments.checkout(user, {
  mode: 'payment',
  currency: 'eur',
  lines: [{ name: 'Annual pass', unitAmount: 9900, quantity: 1 }],
  successUrl: 'https://example.com/billing/done',
})
```

Webhooks are verified and translated in one call; reply with the driver's own acknowledgement:

```ts
const events = await payments.verifyWebhook({ payload: await request.text(), headers: request.headers })
for (const event of events) {
  if (event.type === 'payment.succeeded')
    await markPaid(event.merchantReference, event.amount)
}
return payments.acknowledgeWebhook()
```

| Operation | Stripe | Adyen |
| --- | --- | --- |
| `customer` | Stripe customer, created on first use | Shopper reference (`user-<id>`); Adyen has no customer object |
| `charge` (stored method) | Yes | Yes, as an unscheduled card-on-file payment |
| `createPayment` (browser completes) | Client secret for Stripe.js | Session for Drop-in; needs `returnUrl` |
| `refund` | Yes | Partial by amount, full as a reversal; the outcome arrives by webhook |
| `checkout` (hosted page) | Yes, catalog prices or lines priced here | Lines priced here only, one return URL, no `subscription` mode |
| `paymentMethods`, `removePaymentMethod` | Yes, default marked | Yes, by shopper reference |
| `subscribe`, `cancelSubscription`, `subscriptions` | Yes | No: charge a stored card on your own schedule |
| `verifyWebhook` | `Stripe-Signature` | HMAC per notification item |

An operation a driver cannot do throws `PaymentUnsupportedError`, naming the driver and the operation; a provider's rejection throws `PaymentProviderError` with its status and code. `driver.capabilities` lists what a driver supports.

### Adyen

Set `driver: 'adyen'` in `config/payment.ts` and `ADYEN_API_KEY`, `ADYEN_MERCHANT_ACCOUNT` and `ADYEN_HMAC_KEY` (the hex key of your standard webhook). `ADYEN_ENVIRONMENT=live` also needs `ADYEN_LIVE_URL_PREFIX`, your account's endpoint prefix from the Customer Area. The driver uses Checkout API v72.

The Payment facade's Stripe-only functions (below), the raw `stripe` client and the `manage*` modules remain Stripe's API.

### Billable models

A model with `traits: { billable: true }` gets the driver's operations as instance methods, so they follow `config.payment.driver` too:

```ts
const customer = await user.paymentCustomer()
const result = await user.charge({ amount: 2999, currency: 'eur' }, storedCardId, { reference: `order-${order.id}` })
const session = await user.checkout({
  mode: 'subscription',
  lines: [{ price: 'price_pro_monthly', quantity: 1 }],
  successUrl: 'https://example.com/billing/done',
  cancelUrl: 'https://example.com/billing',
})
const subscription = await user.newSubscription('default', 'pro_monthly')
await user.cancelSubscription(subscription.id, { atPeriodEnd: true })
```

A checkout's `reference` and `metadata` are copied onto the payment or subscription it creates, so the webhooks about those can be attributed; a session's own metadata never reaches them on Stripe. `allowPromotionCodes` and `automaticTax` are Stripe only, and Adyen refuses them.

`paymentCustomer`, `charge`, `createPayment`, `checkout`, `paymentMethods`, `removePaymentMethod`, `newSubscription`, `cancelSubscription` and `activeSubscription` return the driver's own shapes (`CheckoutSession`, `SubscriptionSummary`, ...). `cancelSubscription` refuses a subscription the record does not own. The Stripe-only methods (`createStripeUser` and the other `*StripeUser` methods, `setDefaultPaymentMethod`, `addPaymentMethod`, `updateSubscription`, `createSetupIntent`, `subscriptionHistory` and the Connect methods) throw `PaymentUnsupportedError` when another driver is configured.

### Orders from payment webhooks

With commerce on, the framework mounts this for you at `POST /webhooks/payments` (the `payments` route bundle): point Stripe's endpoint there with `STRIPE_WEBHOOK_SECRET` set, or Adyen's standard webhook with `ADYEN_HMAC_KEY`. Until the secret is set it answers 401 and applies nothing; a signature that does not verify gets 400. To mount it yourself, `orders.receivePaymentWebhook(request)` is the whole handler. Underneath, `orders.handleCommercePaymentEvent` applies one verified event to the order it concerns, from any driver. A payment's `reference` is what the order's `payments.transaction_id` holds.

```ts
import { orders } from '@stacksjs/commerce'
import { paymentDriver } from '@stacksjs/payments'

route.post('/webhooks/payments', async (request) => {
  const payments = paymentDriver()
  const events = await payments.verifyWebhook({ payload: await request.text(), headers: request.headers })
  for (const event of events)
    await orders.handleCommercePaymentEvent(event)
  return payments.acknowledgeWebhook()
})
```

- `payment.succeeded` marks the payment succeeded and moves a pending order to PROCESSING.
- `payment.failed` marks the payment failed, records the provider's reason in `failure_reason` and cancels a pending order.
- `refund.succeeded` adds the refund to `refund_amount`. A payment refunded in full becomes `refunded` and its order REFUNDED; a partial refund leaves it `partiallyRefunded` and the order where it was.

A refund event's `amount` is that one refund, never a running total. Each `(provider, id)` is recorded in `payment_webhook_events` in the same transaction as the update, so a provider's retry does nothing.

## Configure Stripe

Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` in the environment. `config/payment.ts` selects the Stripe driver and reads those values.

Never hardcode API keys or webhook secrets in application source.

## The Payment facade

`Payment` from `@stacksjs/payments` has two halves.

The provider-neutral half goes through the configured driver, so the same call works on Stripe and Adyen. Money is `{ amount, currency }` in minor units, and results are the driver's own shapes:

```ts
import { Payment } from '@stacksjs/payments'

const result = await Payment.charge(user, { amount: 2999, currency: 'usd' }, 'pm_example', {
  reference: `order-${order.id}`,
})

const session = await Payment.checkout(user, {
  mode: 'payment',
  lines: [{ price: 'price_example', quantity: 1 }],
  successUrl: 'https://example.com/billing/success',
  cancelUrl: 'https://example.com/billing',
})

const upgrade = await Payment.subscriptionCheckout(user, 'price_pro', {
  successUrl: 'https://example.com/welcome',
  cancelUrl: 'https://example.com/pricing',
})

const subscription = await Payment.subscribe(user, 'premium-monthly')
await Payment.cancelSubscription(subscription.id, { atPeriodEnd: true })
```

| Provider-neutral | Returns |
| --- | --- |
| `charge(payer, money, paymentMethod, options)` | `PaymentResult` |
| `createPayment(payer, money, options)` | `PaymentResult`, with the browser's `clientConfirmation` |
| `refund(paymentId, { amount?, reason? })` | `RefundResult` |
| `checkout(payer, request)`, `subscriptionCheckout(payer, price, options)` | `CheckoutSession` |
| `subscribe(payer, price, { type? })` | `SubscriptionSummary` |
| `cancelSubscription(id, { atPeriodEnd? })` | `SubscriptionSummary` |
| `subscriptions(payer)` | `SubscriptionSummary[]` |
| `hasActiveSubscription(user, type?)` | `boolean`, from the local `subscriptions` table |
| `getOrCreateCustomer(payer)` | `Customer` |
| `paymentMethods(payer)` | `StoredPaymentMethod[]` |
| `removePaymentMethod(payer, providerId)` | nothing |

The Stripe-only half keeps Stripe's types and throws `PaymentUnsupportedError`, naming the operation, under another driver: `changeSubscription`, `updateCustomer`, `deleteCustomer`, `addPaymentMethod`, `setDefaultPaymentMethod`, `createSetupIntent`, the invoice functions, `createProduct`, `getPrice`, `listProducts`, the coupon and promotion-code functions, and `billingPortal`. Anything Stripe-specific the neutral half cannot say, such as a Connect destination charge or `prorate` on a cancellation, is the `manage*` modules' job.

`cancelSubscription(id)` cancels now; `{ atPeriodEnd: true }` stops renewal and keeps the customer entitled until the period ends, recording that date in the subscription's `ends_at`. It replaces `cancelSubscription(id, immediately)`, whose `false` also cancelled at once, only with a proration.

Amounts are integers in the smallest currency unit. Use `Payment.toCents()`, `Payment.toDollars()`, and `Payment.formatAmount()` for conversion and display.

## Process signed webhooks

```ts
Payment.onPaymentIntent({
  succeeded: async (event) => {
    // Apply idempotent domain updates.
  },
})

const result = await Payment.processWebhook(rawPayload, signature, {
  secret: process.env.STRIPE_WEBHOOK_SECRET,
  tolerance: 300,
})
```

Use the unmodified request body for signature verification. Register webhook handlers during application startup and make every handler idempotent.

The local billing tables track subscriptions, payment methods, products, and transactions. Stripe remains the payment processor and source for provider state.
