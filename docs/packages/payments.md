---
title: Payments Package
description: "provides Stripe customers, payment intents, checkout sessions, subscriptions, payment methods, invoices, products, prices, coupons, transactions, and signe..."
---
# Payments

`@stacksjs/payments` provides Stripe customers, payment intents, checkout sessions, subscriptions, payment methods, invoices, products, prices, coupons, transactions, and signed webhooks.

## Configure Stripe

Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` in the environment. `config/payment.ts` selects the Stripe driver and reads those values.

Never hardcode API keys or webhook secrets in application source.

## Charge a customer

```ts
import { Payment } from '@stacksjs/payments'

const intent = await Payment.charge(user, 2999, 'pm_example', {
  currency: 'usd',
})
```

Amounts are integers in the smallest currency unit. Use `Payment.toCents()`, `Payment.toDollars()`, and `Payment.formatAmount()` for conversion and display.

## Create checkout and subscriptions

```ts
const checkout = await Payment.checkout(user, [
  { price: 'price_example', quantity: 1 },
], {
  success_url: 'https://example.com/billing/success',
  cancel_url: 'https://example.com/billing',
})

const subscription = await Payment.subscribe(user, 'premium-monthly')
```

Subscription creation resolves the Stripe price by lookup key. The user must have a Stripe customer ID before checkout.

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
