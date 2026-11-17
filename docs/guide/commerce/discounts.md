---
title: Commerce Discounts
description: "Automatic discounts and discount codes: buy X get Y, volume tiers, free shipping, amount off products or orders, and the rules for which discounts combine."
---
# Discounts

`commerce.discounts` prices a basket against the store's discounts: the ones that apply by themselves (automatic) and the ones a shopper unlocks with a code. Coupons keep working; they are read as code discounts by the same engine.

Every amount is integer minor units of one currency (1999 is $19.99). Percentages are whole numbers from 0 to 100.

## What a discount can be

| `type` | What it does | Example |
|---|---|---|
| `percentage` | A percentage off the targeted products, or off the order when nothing is targeted | 20% off all socks |
| `fixed_amount` | An amount off, once across the targeted products, per item with `perItem`, or off the order | $5 off, or $2 off each |
| `buy_x_get_y` | Buy a quantity, get a quantity at a percentage off (100 is free). The cheapest qualifying units are the ones discounted | Buy 4, get 4 free |
| `volume` | Quantity breaks over the targeted products together | 5+ for 20% off, 10+ for 30% off |
| `free_shipping` | Waives shipping, optionally only for rates up to `maxShipping` | Free shipping over $40 |

A discount with no `code` is automatic. Targets (`target`, and `buyTarget` / `getTarget` for buy X get Y) name products, variants or categories; an empty target reaches every line.

## Create discounts

```ts
import { discounts } from '@stacksjs/commerce'

// Automatic: applies to every qualifying cart, no code needed.
await discounts.store({
  title: 'BUY 4, GET 4 FREE | 50% OFF',
  type: 'buy_x_get_y',
  buyQuantity: 4,
  getQuantity: 4,
  getPercent: 100,
  target: { productIds: [toeSocks.id] },
})

// Volume tiers on a category.
await discounts.store({
  title: 'Stock up',
  type: 'volume',
  tiers: [{ minQuantity: 5, percent: 20 }, { minQuantity: 10, percent: 30 }],
  target: { categoryIds: [socks.id] },
  combinesWith: { shipping: true },
})

// A code, limited to 500 uses and to orders over $50.
await discounts.store({
  title: 'Welcome',
  code: 'WELCOME10',
  type: 'percentage',
  value: 10,
  minimumSubtotal: 5000,
  usageLimit: 500,
})
```

`store` validates the rule through the engine first, so a discount that could never price a basket (a 150% discount, a volume discount with no tiers) is refused when it is created, not at a shopper's checkout. `deactivate(id)` switches one off.

## Price a basket

```ts
const priced = await discounts.price({
  lines: [{ id: 1, productId: toeSocks.id, quantity: 8, unitPrice: 2500 }],
  codes: ['welcome10'],
  shipping: 500,
})

priced.subtotal       // 20000
priced.discount       // product and order discounts together
priced.shippingDiscount
priced.total          // what to charge, before tax
priced.totalSavings   // compare-at savings plus every discount
priced.applied        // [{ ruleId, title, code, class, amount }]
priced.rejectedCodes  // [{ code, reason }] for the checkout to explain
priced.lines          // per line: discount, total and which discount took what
```

A code that does nothing comes back in `rejectedCodes` with its reason: `not-found`, `inactive`, `expired`, `exhausted`, `requirements-not-met`, `no-eligible-items` or `not-combinable`.

Order discounts are spread across the lines by the largest-remainder method, so each line carries its share to the minor unit and a partial refund of one line can return exactly its part.

## Combining discounts

Every discount has a class: `product` (amount off products, buy X get Y, volume), `order` (amount off the order) or `shipping`. Two discounts apply together only when each says it combines with the other's class (`combinesWith`). By default nothing combines.

When discounts conflict, the one worth most on this basket wins. A line takes at most one product discount, the best one for that line; order discounts apply to what is left after product discounts; shipping discounts apply to the shipping fee.

## Count uses after the order is placed

```ts
const outcomes = await discounts.redeemApplied(priced.applied)
```

Each use is one conditional UPDATE that enforces `usageLimit` and the dates in SQL, so two checkouts racing for the last use cannot both get it. Coupons go through `coupons.redeem`.

## In the browser

The engine is pure and synchronous. A cart page can show the same totals the checkout charges:

```ts
import { applyDiscounts, discountLabel } from '@stacksjs/commerce/discounts/engine'
import { ruleFromDiscount } from '@stacksjs/commerce/discounts/rules'
```

`discountLabel(rule)` gives a badge: `BUY 4, GET 4 FREE`, `20% OFF`, `5+ FOR 20% OFF`, `FREE SHIPPING`.

## The default storefront

The cart, every checkout step and `PlaceOrderAction` price through `app/Storefront/StorefrontPricing.ts` with the store's automatic discounts, so the total a shopper sees is the total the order is written with. Shipping follows the subtotal after discounts, and a free-shipping discount then waives what the flat rule charged. The order summary, the confirmation page and the receipt email show the discount and what it was.

The cart has a discount code field (`POST /api/cart/discount`, `Actions/Storefront/ApplyDiscountCodeAction`). A code is priced against the cart before it is kept, so the shopper is told at once when it has expired or does not reach anything in the cart; `remove` takes it off. The code is checked again when the order is placed: one that has run out in the meantime is taken off the cart and the order is refused with the reason, so nobody is charged a price they were not shown.

## In the dashboard

**Commerce > Discounts** (`/commerce/discounts`) lists every discount with what it does ("BUY 4, GET 4 FREE", "5+ FOR 15% OFF"), whether it applies by itself or by code, its state right now (active, scheduled, used up, expired or disabled) and how often it has been used, with search, filters and the breakdowns above the table. The dialog's fields follow the type: buy X get Y asks what is bought and what comes discounted, volume tiers edits the tiers, and an amount or percentage can come off the order or off chosen products. Products are picked by searching. A preview shows the badge the storefront will draw, and the server checks the rule through the engine before saving, so a rule that could not price a basket is refused field by field.
