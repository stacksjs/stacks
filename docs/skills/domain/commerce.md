---
title: "Commerce skill"
description: "Use when building e-commerce features in Stacks."
---
# Commerce

`stacks-commerce` · Domain packages · model-invoked

The e-commerce layer: thirteen sub-modules and more than twenty models covering
products, orders, customers, coupons, payments, shipping, tax, gift cards,
waitlists, devices, receipts and restaurant features.

## When to reach for it

- The commerce namespace with 15 sub-modules (products, carts, orders, customers, coupons, payments, gift cards, auctions, shipping, tax, waitlists, restaurant, devices, receipts, errors)
- 20+ commerce models
- Checkout and redemption logic
- The commerce configuration

## Covers

`@stacksjs/commerce`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Commerce Namespace
- Sub-Module Operations
- Commerce Models (20+)
- Money paths
- Carts
- Live Delivery Tracking
- Integration with Payments
- Dashboard Routes
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/commerce/src/`
- Default functions: `storage/framework/defaults/functions/commerce/`
- Default models: `storage/framework/defaults/app/Models/commerce/`

## Related skills

- [Payments](/skills/domain/payments)
- [Review](/skills/craft/review)
- [TDD](/skills/craft/tdd)

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-commerce
```

Source: [`stacks-commerce/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-commerce/SKILL.md).
Shadow it for one project with `app/Skills/stacks-commerce/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
