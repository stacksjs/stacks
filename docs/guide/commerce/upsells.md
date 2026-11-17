---
title: Post-Purchase Upsells
description: "A discounted, one-time offer on the order confirmation page that adds to the order just placed, charged to the saved payment method, with no second checkout."
---
# Post-purchase upsells

A post-purchase offer is shown on the order confirmation page, right after checkout: "Thank you for your purchase! Grab 5+ pairs and get 60% off". The shopper picks an option and a quantity and taps **Add to order**. The item joins the order they just placed and is charged to the payment method they already used. There is no second checkout.

`commerce.upsells` does the work; the default storefront's confirmation page shows it.

## Create an offer

Offers are `PostPurchaseOffer` rows:

```ts
await PostPurchaseOffer.create({
  name: 'Sock bundle',
  headline: 'One-time offer',
  message: 'Thank you for your purchase! Grab 5+ pairs and get 60% off.',
  productIds: JSON.stringify([crew.id, ankle.id, boot.id]),
  discountPercent: 60,
  minQuantity: 5,
  defaultQuantity: 5,
  // Only orders that contain toe socks see it. Leave empty for every order.
  triggerProductIds: JSON.stringify([toeSocks.id]),
  minOrderTotal: 5000,
  windowMinutes: 30,
  priority: 10,
})
```

| Field | Meaning |
|---|---|
| `productIds` | The products offered, in the order shown. A product with variants asks the shopper to choose one |
| `discountPercent` | Off each offered product's own price (a variant's price when it has one) |
| `minQuantity`, `maxQuantity`, `defaultQuantity` | What one acceptance may take, and where the field starts |
| `triggerProductIds`, `minOrderTotal` | Which orders qualify |
| `windowMinutes` | How long after the order is placed the offer stays open |
| `startsAt`, `endsAt`, `isActive`, `priority` | When it runs, and which shows first when several qualify |

## Show it

```ts
import { upsells } from '@stacksjs/commerce'

const offers = await upsells.presentOffers(order.id)
// [{ offerId, headline, message, minQuantity, defaultQuantity, expiresAt,
//    products: [{ productId, name, imageUrl, unitPrice, regularPrice, percentOff,
//                 variants: [{ id, name, options, unitPrice, inStock }], status }] }]
```

`presentOffers` records a `viewed` response per product shown, once however often the page is opened, which is what conversion is measured against. An order that is cancelled or refunded, outside the window, or that has answered every product of an offer is shown nothing.

## Take it

```ts
import { paymentDriver } from '@stacksjs/payments'

const result = await upsells.acceptOffer({
  orderId: order.id,
  offerId,
  productId,
  variantId,
  quantity: 5,
  charge: upsells.chargeDefaultMethod(paymentDriver(), payer),
  taxFor: amount => Math.round(amount * 0.0825),
})
```

The price comes from the catalog and the offer, never from the request. One acceptance runs in three steps:

1. **Claim.** One transaction writes the response as `pending` with the line priced, and reserves the stock. The unique `(order, offer, product)` index makes the offer one-time: a double click or a second tab finds the claim taken and is charged nothing.
2. **Charge.** Outside any transaction, with an idempotency key fixed per claim, so a retried request cannot charge twice.
3. **Finish.** A succeeded payment adds the order line, the payment row and the new totals in one transaction and emits `order:upsell-accepted`.

| Result | What happened |
|---|---|
| `{ ok: true, status: 'accepted' }` | The line is on the order |
| `{ ok: true, status: 'pending' }` | The provider is still processing; the webhook finishes it |
| `{ ok: false, reason: 'payment-requires-action' }` | The bank wants 3-D Secure. Finish it in the browser from `clientConfirmation`; the payment webhook adds the line. The items stay reserved meanwhile |
| `{ ok: false, reason: 'payment-failed' }` | Declined. The stock is released and the shopper may try again while the offer is open |
| `already-responded`, `out-of-stock`, `invalid-quantity`, `invalid-variant`, `offer-expired`, ... | Refused before any money moved, with a `message` to show |

`charge` is one of:

- `upsells.chargeDefaultMethod(driver, payer)`: the payer's default saved payment method, off-session.
- `upsells.chargeWith(driver, { payer, paymentMethod })`: a specific saved method.
- Your own function taking `{ amount, currency, idempotencyKey, reference, ... }`.
- `'collect-later'`: add the line without taking a payment, for stores that invoice or capture later. It has to be said, so leaving the charge out can never give goods away.

The payment webhook (`POST /webhooks/payments`) finishes a pending acceptance when its payment succeeds, and releases it when the payment fails, without cancelling the order, which was paid for already. Schedule `upsells.releaseStalePending({ olderThanMinutes: 60 })` to put back stock held by a 3-D Secure prompt the shopper walked away from.

## Decline and measure

```ts
await upsells.declineOffer(order.id, offerId)

await upsells.offerStats(offerId)
// { views, accepted, declined, pending, failed, conversionRate, revenue, units }
```

## The default storefront

`/orders/{id}` is the confirmation page. It opens only with the order's unguessable key, `?key=`, which `PlaceOrderAction` redirects to and the receipt email links to; a sequential order id alone shows nothing. Under the summary it renders the offer as a row of cards with an option picker, a quantity field and **Add to order**, plus **No thanks**. The forms post to:

| Route | Action |
|---|---|
| `POST /api/orders/offers/accept` | `Actions/Storefront/AcceptOrderOfferAction` |
| `POST /api/orders/offers/decline` | `Actions/Storefront/DeclineOrderOfferAction` |

How the addition is paid for is one file, `app/Storefront/UpsellCharge.ts`. The default charges off-session through the provider that took the order's payment, or collects the addition the same way as the order when the order recorded no provider payment. Copy it into your app at the same path to charge your own way.

## In the dashboard

**Commerce > Upsells** (`/commerce/upsells`) lists the offers with their funnel: how many times each was shown, how many orders took it, the conversion and what it added to orders, plus the totals and best offers across all of them. The dialog edits what the shopper reads (with a preview of the confirmation-page banner), the products offered, the discount and quantities, which orders see it and for how long. **View results** shows the funnel bar by bar and the latest responses, each with its order and outcome. An offer that orders have already answered cannot be deleted, since its responses are the record of what was added; switch it off instead.
