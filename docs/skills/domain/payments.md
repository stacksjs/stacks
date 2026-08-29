---
title: "Payments skill"
description: "Use when implementing payment processing in Stacks."
---
# Payments

`stacks-payments` · Domain packages · model-invoked

Stripe, in depth: charges, subscriptions, checkout sessions, customers, payment
methods, invoices, coupons, promo codes, products, prices and webhooks, behind the
`Payment` facade.

## When to reach for it

- Stripe charges
- Subscriptions
- Checkout sessions
- Customer management
- Payment methods
- Invoices
- Coupons
- Promo codes
- Products
- Prices
- Webhooks
- The Payment facade

## Covers

`@stacksjs/payments`, `config/payment.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Package Exports
- Payment Facade
- Idempotency
- config/payment.ts
- config/saas.ts
- Database Tables Used
- User Model Requirements
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/payments/src/`
- Payment facade: `storage/framework/core/payments/src/payment.ts`
- Stripe driver: `storage/framework/core/payments/src/drivers/stripe.ts`
- Billable modules: `storage/framework/core/payments/src/billable/`
- Configuration: `config/payment.ts`
- SaaS config: `config/saas.ts`
- Default billing functions: `storage/framework/defaults/functions/billing/payments.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-payments
```

Source: [`stacks-payments/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-payments/SKILL.md).
Shadow it for one project with `app/Skills/stacks-payments/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
