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

| Operation | Stripe | Adyen | Paddle | Lemon Squeezy |
| --- | --- | --- | --- | --- |
| `customer` | Stripe customer, created on first use | Shopper reference (`user-<id>`); Adyen has no customer object | Paddle customer, found or created by email | Store customer, found or created by email |
| `charge` (stored method) | Yes | Yes, as an unscheduled card-on-file payment | No: every Paddle payment goes through its checkout | No: every payment goes through the hosted checkout |
| `createPayment` (browser completes) | Client secret for Stripe.js | Session for Drop-in; needs `returnUrl` | Transaction for Paddle.js | No |
| `refund` | Yes | Partial by amount, full as a reversal; the outcome arrives by webhook | A refund request Paddle reviews; `pending` until the webhook | Issued at once, whole or partial, against the order |
| `checkout` (hosted page) | Yes, catalog prices or lines priced here | Lines priced here only, one return URL, no `subscription` mode | Your payment-link page; one return URL; `subscription` mode with catalog prices | Hosted page selling one variant; a line priced here sells as the custom-price variant |
| `paymentMethods`, `removePaymentMethod` | Yes, default marked | Yes, by shopper reference | Yes; Paddle keeps no default | No: the card lives on the subscription |
| `subscribe` | Yes | No: charge a stored card on your own schedule | No: a subscription starts at checkout | No: a subscription starts at checkout |
| `cancelSubscription`, `subscriptions` | Yes | No | Yes | Yes, at period end only; listed by email |
| `verifyWebhook` | `Stripe-Signature` | HMAC per notification item | `Paddle-Signature` | `X-Signature` |

An operation a driver cannot do throws `PaymentUnsupportedError`, naming the driver and the operation; a provider's rejection throws `PaymentProviderError` with its status and code. `driver.capabilities` lists what a driver supports.

### Adyen

Set `driver: 'adyen'` in `config/payment.ts` and `ADYEN_API_KEY`, `ADYEN_MERCHANT_ACCOUNT` and `ADYEN_HMAC_KEY` (the hex key of your standard webhook). `ADYEN_ENVIRONMENT=live` also needs `ADYEN_LIVE_URL_PREFIX`, your account's endpoint prefix from the Customer Area. The driver uses Checkout API v72.

### Paddle

Paddle Billing is a merchant of record: it is the seller, charges and remits the tax, and reviews refunds. The driver says so rather than hiding it.

- **Setup:** set `driver: 'paddle'` in `config/payment.ts`, plus `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN` (a client-side token, for Paddle.js) and `PADDLE_WEBHOOK_SECRET` (your notification destination's secret key). `PADDLE_ENVIRONMENT` is `sandbox` unless set to `live`, and the API key must belong to that environment.
- **Checkout:** Paddle has no hosted checkout page. A transaction's payment link is your own page, which loads Paddle.js. Stacks serves that page at `GET /payments/checkout`; set it as the default payment link in Paddle (Checkout > Checkout settings). `checkout()` stores its `successUrl` on the transaction, and the page hands it to Paddle.js. The page needs no inline script, so an app Content-Security-Policy that allows `self` and `https://cdn.paddle.com` keeps working.
- **Payments:** every payment is a transaction the payer completes in Paddle.js. `createPayment` returns `{ provider: 'paddle', transactionId, successUrl? }` for `Paddle.Checkout.open()`. Amounts priced in a request are tax-inclusive, so the payer pays exactly that. Lines priced here use `PADDLE_TAX_CATEGORY` (default `standard`), which must be enabled on your Paddle account.
- **Subscriptions:** they start at checkout, in `subscription` mode with catalog prices that carry a billing cycle. A trial belongs to the Paddle price, not the checkout.
- **Refunds:** each refund is a request Paddle reviews. It returns `pending`, and an `adjustment.updated` webhook settles it as `refund.succeeded` or `refund.failed`. A partial amount is taken from the transaction's line items in order, tax included.
- **Webhooks:** Paddle wants a 200 within five seconds, and signatures older than five seconds are refused, as Paddle's SDKs do.
- **Verification:** the driver is checked against Paddle's API reference and its webhook signatures against Paddle's official Node SDK. It has not yet run against a live Paddle account.

### Lemon Squeezy

Lemon Squeezy is a merchant of record with a hosted checkout, and its API is narrower than a processor's.

- **Setup:** set `driver: 'lemonsqueezy'` in `config/payment.ts`, plus `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID` and `LEMONSQUEEZY_WEBHOOK_SECRET` (the signing secret of your store's webhook). `LEMONSQUEEZY_TEST_MODE=true` creates checkouts in test mode.
- **Checkout:** a checkout sells one variant, so `checkout()` takes exactly one line. A line naming `price` is a variant id, and `quantity` above 1 is sent as that variant's quantity. A line priced here (`name` and `unitAmount`) is sold as the variant in `LEMONSQUEEZY_VARIANT_ID` at a custom price of `unitAmount x quantity`, in the store's currency; a checkout in another currency is refused. `successUrl` is the redirect after paying, and `allowPromotionCodes` shows the discount field. There is no cancel page and no per-checkout trial: a trial is set on the subscription variant.
- **No server-side payments:** `charge`, `createPayment`, `subscribe` and the payment-method calls are unsupported. Everything starts at the hosted checkout.
- **Refunds:** issued at once against the order, whole or by amount. A full refund comes back with `amount: null`, since Lemon Squeezy does not restate it.
- **Subscriptions:** listed by the payer's email in your store. Cancelling always runs to the end of the period paid for, so `cancelSubscription` needs `{ atPeriodEnd: true }`. Until then a cancelled subscription reports `active` with `cancelAtPeriodEnd: true`; it is `canceled` once it expires.
- **Webhooks:** `X-Signature` is HMAC-SHA256 hex of the raw body under the signing secret. A delivery carries no event id, so a digest of its bytes is the id, which a retry repeats. `order_refunded` states the order's refunded total rather than the one refund, so it arrives as `refundedTotal` and commerce records the difference from what it already has.
- **Verification:** checked against Lemon Squeezy's API reference. It has not yet run against a live store.

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

A subscription checkout can start with a trial: `trialDays: 14`. A checkout's `reference` and `metadata` are copied onto the payment or subscription it creates, so the webhooks about those can be attributed; a session's own metadata never reaches them on Stripe. `allowPromotionCodes` and `automaticTax` are Stripe only, and Adyen refuses them.

`paymentCustomer`, `charge`, `createPayment`, `checkout`, `paymentMethods`, `removePaymentMethod`, `newSubscription`, `cancelSubscription` and `activeSubscription` return the driver's own shapes (`CheckoutSession`, `SubscriptionSummary`, ...). `cancelSubscription` refuses a subscription the record does not own. The Stripe-only methods (`createStripeUser` and the other `*StripeUser` methods, `setDefaultPaymentMethod`, `addPaymentMethod`, `updateSubscription`, `createSetupIntent`, `subscriptionHistory` and the Connect methods) throw `PaymentUnsupportedError` when another driver is configured.

### Orders from payment webhooks

With commerce on, the framework mounts this for you at `POST /webhooks/payments` (the `payments` route bundle): point Stripe's endpoint there with `STRIPE_WEBHOOK_SECRET` set, Adyen's standard webhook with `ADYEN_HMAC_KEY`, a Paddle notification destination with `PADDLE_WEBHOOK_SECRET`, or a Lemon Squeezy store webhook with `LEMONSQUEEZY_WEBHOOK_SECRET`. Until the secret is set it answers 401 and applies nothing; a signature that does not verify gets 400. To mount it yourself, `orders.receivePaymentWebhook(request)` is the whole handler. Underneath, `orders.handleCommercePaymentEvent` applies one verified event to the order it concerns, from any driver. A payment's `reference` is what the order's `payments.transaction_id` holds.

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
