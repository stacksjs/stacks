---
title: "Commerce skill"
description: "Use when building e-commerce features in Stacks - the commerce namespace with 15 sub-modules (products, carts, orders, customers, coupons, payments, gift cards, auctions, shipping, tax, waitlists, restaurant, devices, receipts, errors), 20+ commerce models, checkout and redemption logic, or the commerce configuration. Covers @stacksjs/commerce."
---
# Commerce

`stacks-commerce` · Native Stacks · model-invoked

Use when building e-commerce features in Stacks - the commerce namespace with 15 sub-modules (products, carts, orders, customers, coupons, payments, gift cards, auctions, shipping, tax, waitlists, restaurant, devices, receipts, errors), 20+ commerce models, checkout and redemption logic, or the commerce configuration. Covers @stacksjs/commerce.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Commerce Namespace
- Sub-Module Operations
- Commerce Models (20+)
- Money paths
- Carts
- Live Delivery Tracking
- Integration with Payments
- Dashboard Routes
- Enable the feature and choose the native seam
- Gotchas
- Downstream

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-commerce
```

Source: [`stacks-commerce/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-commerce/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-commerce/SKILL.md`. See [Using skills](/skills/using).
