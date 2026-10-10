---
title: "Payments skill"
description: "Use when implementing Stacks payment drivers, charges, subscriptions, checkout, customer methods, Stripe billing/catalog/Connect, provider webhooks, or the Payment facade. Covers @stacksjs/payments and config/payment.ts."
---
# Payments

`stacks-payments` · Native Stacks · model-invoked

Use when implementing Stacks payment drivers, charges, subscriptions, checkout, customer methods, Stripe billing/catalog/Connect, provider webhooks, or the Payment facade. Covers @stacksjs/payments and config/payment.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Payment Drivers (provider-neutral)
- Key Paths
- Package Exports
- Payment Facade
- Idempotency
- config/payment.ts
- config/saas.ts
- Database Tables Used
- User Model Requirements
- Gotchas

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-payments
```

Source: [`stacks-payments/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-payments/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-payments/SKILL.md`. See [Using skills](/skills/using).
