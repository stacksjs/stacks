---
name: stacks-commerce
description: Use when building e-commerce features in Stacks - the commerce namespace (products, carts, orders, customers, coupons, discounts, post-purchase upsells, payments, gift cards, auctions, shipping, tax, waitlists, restaurant, devices, receipts, errors), the commerce models, checkout, discount and redemption logic, or the commerce configuration. Covers @stacksjs/commerce.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Commerce

Comprehensive e-commerce module with 21 sub-modules in the `commerce` namespace and 42 models.

## Key Paths
- Core package: `storage/framework/core/commerce/src/`
- Default functions: `storage/framework/defaults/functions/commerce/`
- Default models: `storage/framework/defaults/app/Models/commerce/`

## Commerce Namespace

```typescript
import { commerce } from '@stacksjs/commerce'

commerce.products      // Products, variants, units, manufacturers, reviews, categories
commerce.carts         // The pre-checkout basket
commerce.orders        // Orders, order items, export, checkout guards
commerce.customers     // Customer records
commerce.coupons       // Coupons, including atomic redemption
commerce.discounts     // Automatic + code discounts: buy X get Y, volume tiers, free shipping
commerce.upsells       // Post-purchase offers: one-click, discounted additions to a placed order
commerce.payments      // Payment records, refunds
commerce.giftCards     // Gift cards, balance, redemption and reload
commerce.auctions      // Benefit auctions: lots, bids, proxy bidding, pledges
commerce.shippings     // Methods, rates, zones, routes, couriers, live tracking
commerce.tax           // Tax rates and breakdown
commerce.waitlists     // Waitlists
commerce.restaurant    // Restaurant features (lives at waitlists/restaurant)
commerce.devices       // Print device management
commerce.receipts      // Receipt records
commerce.errors        // Error tracking
```

`restaurant` is re-exported from `waitlists/restaurant` rather than having a
directory of its own, which is why the source tree shows one fewer directory
than the namespace has keys. `tests/commerce.test.ts` asserts the exact key set,
so adding a sub-module means updating that count.

## Sub-Module Operations

Each sub-module typically provides:
- `fetchAll()` - list all
- `fetchById(id)` - get one
- `store(data)` - create, plus `bulkStore`
- `update(id, data)` - update, plus `bulkUpdate`
- `destroy(id)` - delete, plus `bulkDestroy`

### Products Sub-Module
- Products: items, variants, units
- Manufacturers
- Reviews
- Categories
- Product waitlists

### Orders Sub-Module
- Order CRUD
- Order items
- Order export

### Shipping Sub-Module
- Shipping methods
- Shipping rates (weight-based)
- Shipping zones
- Delivery routes and their stops
- Couriers
- Digital deliveries
- License keys (the delivery CRUD; selling and activating licenses is `commerce.licensing`, see `stacks-licensing`)
- **Live tracking** (`commerce.shippings.tracking`) - see below

## Commerce Models (20+)

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| Product | name, price, inventoryCount, allergens(JSON) | belongsTo: Category, Manufacturer; hasMany: Review, ProductUnit, ProductVariant |
| ProductVariant | variant, type, options, status, sku (unique per product), price / compareAtPrice (minor units; null price inherits the product's), inventoryCount (null = untracked) | belongsTo: Product |
| ProductUnit | unit pricing | belongsTo: Product |
| Category | name, slug, isActive, displayOrder | hasMany: Product |
| Cart | status, total, currency(USD), expiresAt | hasMany: CartItem; belongsTo: Customer |
| CartItem | quantity, unitPrice, totalPrice | belongsTo: Cart |
| Order | status, totalAmount, orderType, deliveryAddress | hasMany: OrderItem, Payment; belongsTo: Customer |
| OrderItem | quantity, price | belongsTo: Order, Product |
| Coupon | code(unique), discountType, discountValue, usageLimit | hasMany: Order |
| Discount | title, code (null = automatic), type (percentage/fixed_amount/buy_x_get_y/volume/free_shipping), target JSON, buy/get quantities, tiers JSON, minimums, maxAmount, combinesWith*, usageLimit | |
| PostPurchaseOffer | headline, message, productIds JSON, discountPercent, min/default/maxQuantity, triggerProductIds JSON, minOrderTotal, windowMinutes, priority | hasMany: PostPurchaseOfferResponse |
| PostPurchaseOfferResponse | status (viewed/pending/accepted/declined/failed), product/variant, quantity, unitPrice, amount, paymentReference; unique (order, offer, product) | belongsTo: PostPurchaseOffer, Order |
| GiftCard | code(unique), initialBalance, currentBalance, isReloadable | belongsTo: Customer |
| Customer | name, email, totalSpent, status | hasMany: Order, GiftCard, Review, Payment |
| Manufacturer | manufacturer info | hasMany: Product |
| Review | rating(1-5), content, isVerifiedPurchase, helpfulVotes | belongsTo: Product, Customer |
| ShippingRate | weightFrom, weightTo, rate | belongsTo: ShippingMethod, ShippingZone |
| DeliveryRoute | stops, totalDistance, status(planned/active/completed), startedAt | belongsTo: Courier; hasMany: DeliveryStop, CourierPing |
| DeliveryStop | sequence, status, address, latitude, longitude, etaAt, arrivedAt | belongsTo: DeliveryRoute, Order |
| Courier | name, phone, vehicleNumber, status, latitude, longitude, heading, lastPingAt | hasMany: DeliveryRoute, CourierPing |
| CourierPing | latitude, longitude, heading, speed, accuracy, recordedAt | belongsTo: Courier, DeliveryRoute |
| TaxRate | name, rate(0-100), type(VAT/GST/Sales Tax) | |
| LicenseKey | key(XXXX-XXXX-XXXX-XXXX-XXXX), template, tier, status, updatesUntil, maxDevices, seats | belongsTo: Customer, Product, Order, Team; hasMany: LicenseActivation, LicenseSeat |
| DigitalDelivery | downloadLimit, expiryDays, automaticDelivery | |
| WaitlistProduct | product waitlist tracking | |
| Receipt | receipt records | |

## Money paths

Three operations move money, and all three are written as a **single conditional
UPDATE** rather than read-check-write. Concurrency here is not theoretical: two
parallel requests against a read-then-write redemption both see the pre-state
and both succeed, which is a coupon redeemed past its limit or a gift card spent
twice.

### Redeeming a coupon

```ts
const result = await commerce.coupons.redeem(couponId)

if (!result.ok) {
  // 'not-found' | 'inactive' | 'expired' | 'limit-reached'
  throw new HttpError(400, `Coupon cannot be redeemed: ${result.reason}`)
}
// result.coupon reflects the post-redemption state.
```

`redeem` bumps `usage_count` and enforces `usage_limit`, `is_active` and the
start/end dates in the WHERE clause, so the database decides the race. A
`usage_limit` of `NULL` means unlimited. Do not fetch, check and then call
`update()` to increment: that is the exact pattern this replaced.

### Spending or reloading a gift card

```ts
await commerce.giftCards.updateBalance(cardId, -25)  // redeem 25
await commerce.giftCards.updateBalance(cardId, 50)   // reload 50
```

One entry point for both directions, and they are deliberately asymmetric:

| | Redemption (`amount < 0`) | Reload (`amount > 0`) |
|---|---|---|
| Allowed status | `ACTIVE` | `ACTIVE`, or `USED` when the card is `isReloadable` |
| `lastUsedDate` | stamped | left alone |
| Balance floor | cannot go below 0 | n/a |
| Expiry | refused past `expiryDate` | refused past `expiryDate` |

The balance lands on 0 and the status flips to `USED` in the same statement. A
reloadable card can be revived from `USED`; a non-reloadable one cannot, and
throws `Gift card is not reloadable`. `deactivate(id)` is the terminal state and
reports whether a row actually changed.

### Recording a refund

`commerce.payments.recordRefund(id, amount)` takes **integer minor units** and
enforces `refund_amount + amount <= amount` in the WHERE clause, so operators
cannot over-refund a payment by racing each other. It flips the status to
`refunded` or `partiallyRefunded` depending on where the total lands.

## Discounts

`commerce.discounts` prices a basket with a pure engine
(`@stacksjs/commerce/discounts/engine`, browser-safe) against `Discount` rows and
coupons. Full guide: `docs/guide/commerce/discounts.md`.

```ts
const priced = await commerce.discounts.price({ lines, codes, shipping })
// priced.total, priced.discount, priced.applied, priced.rejectedCodes, priced.lines[i].allocations
await commerce.discounts.redeemApplied(priced.applied)   // atomic, limit enforced in SQL
```

- No `code` means automatic. Classes are product / order / shipping; two apply
  together only when each `combinesWith` the other's class (default: none).
  A line takes its single best product discount; order discounts apply to the
  remainder and are spread over lines by largest remainder.
- Buy X get Y discounts the cheapest qualifying units. Minimums count the
  targeted lines for product discounts, the basket otherwise.
- Rule ids are `discount:<id>` / `coupon:<id>`; `ruleFromDiscount` /
  `ruleFromCoupon` (pure, `discounts/rules`) map rows for pages that read their
  own SQLite. `store()` validates the rule through the engine before inserting.

## Post-purchase upsells

`commerce.upsells`: a discounted, one-time offer on the confirmation page that
adds to the order just placed. Full guide: `docs/guide/commerce/upsells.md`.

```ts
const offers = await commerce.upsells.presentOffers(order.id)  // records `viewed`
const result = await commerce.upsells.acceptOffer({
  orderId, offerId, productId, variantId, quantity,
  charge: commerce.upsells.chargeDefaultMethod(paymentDriver(), payer), // or chargeWith, or 'collect-later'
})
```

- Claim (response `pending` + stock reserved, one transaction; the unique
  `(order, offer, product)` index is the one-time guard), then charge outside
  the transaction with a per-claim idempotency key, then finish (order item,
  payment row, totals) in one transaction.
- `requires_action` (3-D Secure) stays pending; `handleCommercePaymentEvent`
  finishes or releases it by payment reference and never cancels the paid
  order. Schedule `releaseStalePending()` for abandoned prompts.
- Prices come from the catalog and offer, never the request. `charge` is
  required; `'collect-later'` is the explicit no-payment path.

## Dashboard pages

`/commerce/discounts` and `/commerce/upsells` (components
`Dashboard/Commerce/CommerceDiscounts*` and `CommerceUpsells*`, actions
`Actions/Dashboard/Commerce/CommerceDiscount*` / `CommerceUpsell*`, routes in
`routes/dashboard-api.ts`). Both models are in `dedicatedPages`, so no generic
`/models/...` page duplicates them. Writes go through `discountWriteData` /
`upsellWriteData` (field errors, engine-checked); an answered offer cannot be
deleted (409). `CommerceProductPicker` is the shared multi-product search.

## The default storefront

- Cart, checkout steps and `PlaceOrderAction` price through
  `app/Storefront/StorefrontPricing.ts` (automatic discounts; shipping on the
  discounted subtotal). `PlaceOrderAction` uses `orders.placeOrder` (atomic,
  stock-guarded, idempotent per cart).
- `carts.discount_code` holds the shopper's code (`POST /api/cart/discount`);
  pages read it through `storefrontCartSummary`, and `PlaceOrderAction`
  re-checks it and refuses (clearing it) when it no longer applies.
- `/orders/{id}` opens only with `?key=<orders.tracking_token>`
  (`app/Storefront/OrderKey.ts`); never link an order page by id alone. It renders
  the offer, posting to `/api/orders/offers/accept|decline`. The charge for an
  accepted offer is decided in `app/Storefront/UpsellCharge.ts` (override it).

## Carts

`commerce.carts` is the pre-checkout basket, with the same CRUD shape as every
other sub-module plus bulk variants. `commerce.orders` owns what happens after
checkout, and `orders/guards.ts` holds the pre-flight checks that run between
the two, including `cleanupAbandonedCarts({ olderThanDays, limit })` for the
sweeper you schedule daily.

## Live Delivery Tracking

`commerce.shippings.tracking` is the moving part of shipping: position ingest,
the stop lifecycle, and the fan-out that drives a customer's tracking map.

```ts
import { commerce } from '@stacksjs/commerce'

const { tracking } = commerce.shippings

// Put an order on a route, then set the vehicle moving.
const stop = await tracking.assignStop({
  deliveryRouteId: route.id,
  orderId: order.id,
  address: '3821 Grand View Blvd, Los Angeles CA 90066',
  latitude: 34.0128,
  longitude: -118.4361,
})
await tracking.startRoute(route.id)
await tracking.startStop(stop.id)      // order -> OUT_FOR_DELIVERY

// One call per position fix from the courier's device.
await tracking.recordCourierPing({
  courierId, latitude, longitude, speed, accuracy,
})

await tracking.completeStop(stop.id)   // order -> DELIVERED, route closes itself
```

### What `recordCourierPing` does

One entry point, so a tracking page never shows a position its ETA disagrees
with. Per fix it: appends to `courier_pings`, updates the courier's denormalised
present position, recomputes the served stop's ETA, broadcasts the position,
and latches `delivery:nearby` / `delivery:arrived` so each fires exactly once.

A fix reporting worse than 250m accuracy is stored but does not move the courier
or trip a threshold.

### Two fan-outs, on purpose

| Path | Carries | Why |
|---|---|---|
| Realtime channel (`@stacksjs/realtime`) | `delivery:position`, plus every state change | Fires every few seconds per delivery; only browsers care |
| Event bus (`@stacksjs/events`) | `delivery:assigned`, `:started`, `:nearby`, `:arrived`, `:completed`, `:failed` | Where notifications, analytics and fulfilment subscribe |

Position never reaches the event bus. Subscribe to the state changes to send an
SMS without being woken several times a minute per active delivery.

Channels are `order.{id}` for a customer's page and `delivery-route.{id}` for a
dispatch map, both private: authorise them in your `setWsAuthenticator`.

### Order status

`OUT_FOR_DELIVERY` sits between `SHIPPED` and `DELIVERED`, reachable from
`PROCESSING` too (a local kitchen goes straight out on its own van), and falls
back to `SHIPPED` when a drop fails and the parcel returns to the depot.
`canTransition` enforces it.

### Geodesy

`distanceInMeters`, `bearingInDegrees`, `estimateSecondsRemaining`, `isWithin`
and `hasCoordinates` are exported for building dispatch views. The ETA pads
straight-line distance by a detour factor and returns `null` for a stationary
courier rather than `Infinity`.

## Integration with Payments
Commerce takes payments through `@stacksjs/payments`, on whichever provider `config.payment.driver` names:
```typescript
import { Payment } from '@stacksjs/payments'
await Payment.charge(customer, { amount: order.totalAmount, currency: 'usd' }, paymentMethodId, { reference: `order-${order.id}` })
```
The provider's webhook reaches orders through `POST /webhooks/payments` (see `stacks-payments`).

## Dashboard Routes
Commerce dashboard pages use `/commerce/*` on the dashboard server, for example
`/commerce/products` and `/commerce/orders`. Their data Actions use
`/api/dashboard/*`. Verify the actual page registry instead of assuming that
every commerce model has an automatically generated dashboard view.

## Enable the feature and choose the native seam

Read `config/commerce.ts` and the feature lifecycle before adding a parallel
cart or checkout library. `buddy commerce:install` enables the feature and
copies its owned scaffold paths without overwriting existing application work
by default. The `@stacksjs/features` manifest owns its tables and the migration
runner gates disabled feature migrations. Changing `enabled` alone does not
prove that a route bundle or view has been mounted.

The namespace's helpers, model methods and provider APIs are separate seams.
Use the existing checkout guards, order state transitions, idempotency and
provider webhook Actions for an order flow; creating a local payment row does
not establish that a provider collected money. Public storefront data should
carry the product/customer/site scope chosen at its boundary.

For variant selection, shipping zones/rates, auctions, digital deliveries or
loyalty rules, inspect the selected submodule's exported operations and its
tests rather than extrapolating a generic CRUD interface. Native models cover
more domain features than the short table here lists. Feature-specific routes
and jobs also need their enabled feature, tables and worker prerequisites.

## German tills: TSE signing and the DSFinV-K export

Three pure modules for a till in Germany (KassenSichV, § 146a AO). They hold the rules, not a certification: whether a till is compliant depends on the whole system and its operator.

- `@stacksjs/commerce/fiskaly`: a client for fiskaly SIGN DE v2, a cloud TSE. `fiskalySignDe({ apiKey, apiSecret, baseUrl?, fetch? })` caches and refreshes its token; `provisionTss(api, { tssId, clientId, clientSerialNumber, adminPin, adminPuk? })` takes a TSS from nothing (or from where an earlier attempt stopped; keep the PUK it answers) to INITIALIZED with a client; `startTransaction` / `finishTransaction` sign a sale (revisions 1 and 2). `FiskalyError.outage` says when a sale should go on unsigned and be marked.
- `@stacksjs/commerce/kassensichv`: the VAT keys (`DE_VAT_KEYS`: 1 = 19%, 2 = 7%, 5/6/7 = 0%), `processData` (`Beleg^75.33_7.99_0.00_0.00_0.00^10.00:Bar_64.30:Unbar`), `fiskalyReceiptFor` (amounts per VAT rate and payment type), `receiptQrCode` (the twelve-field `V0;…` QR content of DSFinV-K Anhang I), `receiptVatLines` and `TSE_FAILURE_NOTICE`.
- `@stacksjs/commerce/dsfinvk`: the export. `DSFINVK_TABLES` are the twenty tables of the official index.xml (DSFinV-K 2.4: files, columns, order, types, lengths, decimals); `dsfinvkExport(closings)` builds every CSV plus `index.xml` and `gdpdu-01-09-2004.dtd` from a till's cash point closings, totals per business case and payment type included. Rows are validated (mandatory columns, lengths, enumerations, time formats); a broken export throws `DsfinvkError` instead of being written. Zip the files yourself (`zipEntries` in `@stacksjs/storage`).

```typescript
import { fiskalyReceiptFor, processData, receiptQrCode } from '@stacksjs/commerce/kassensichv'
import { fiskalySignDe } from '@stacksjs/commerce/fiskaly'

const vat = [{ key: 1, grossCents: 1500 }, { key: 2, grossCents: 500 }]
const payments = [{ kind: 'Unbar', cents: 2000 }]
const api = fiskalySignDe({ apiKey, apiSecret })
await api.startTransaction(tssId, txId, clientId)
const tx = await api.finishTransaction(tssId, txId, clientId, fiskalyReceiptFor({ vat, payments }))
const qr = receiptQrCode({ clientSerialNumber, processType: 'Kassenbeleg-V1', processData: processData({ vat, payments }), transactionNumber: tx.number, signatureCounter: Number(tx.signature!.counter), start: tx.time_start, end: tx.time_end!, signatureAlgorithm: tx.signature!.algorithm, logTimeFormat: tx.log!.timestamp_format, signature: tx.signature!.value, publicKey: tx.signature!.public_key })
```

Traps: amounts are gross cents (German prices include VAT). A refund is a new receipt with negative amounts, referenced to the sale (`references`, REF_TYP `Transaktion`); AVBelegstorno is not for TSE tills. A transaction the TSE could not sign still goes into the export, with `tse.error` (TSE_TA_FEHLER) and no signature. fiskaly client serials (and KASSE_SERIENNR) may not contain `_` or `/` (`isClientSerialNumber`).

## Gotchas

### Writing raw SQL here

Two dialect traps have each shipped a broken money path, so both are now guarded
by `src/tests/sql-dialect-portability.test.ts`:

- **Placeholders.** Postgres numbers them (`$1`); a literal `?` is a syntax
  error. Render them with `sqlHelpers(env.DB_CONNECTION || 'sqlite').param(n)`.
- **Booleans.** A `schema.boolean()` attribute becomes a real `BOOLEAN` on
  Postgres, so `is_active = 1` is `operator does not exist: boolean = integer`.
  Use `sqlHelpers(...).boolTrue` / `.boolFalse`.

Both pass on SQLite, which is what the tests run against, so neither shows up
locally. That is the whole reason the source-level test exists.

### Reading back a row you just inserted

Use `insertedId(result)` from `utils/inserted-id`. Couriers disagree: SQLite
reports `lastInsertRowid`, MySQL reports `insertId`, and Postgres reports
neither without a `RETURNING` clause (fall back to the `uuid` the row was
written with).

**Never read a row count as an id.** `numInsertedOrUpdatedRows` says how many
rows changed, not which one, so a successful single-row insert reports `1` and
the caller fetches row 1 of the table instead of the new record. `mutationCount`
is the helper for when the count is genuinely what you want.

### Everything else

- Commerce models are auto-generated - edit definitions, not generated files
- Run `buddy generate:migrations` after changing a commerce model, and read the
  SQL before applying it
- Order `observe: true` emits events on create/update/delete
- Products have JSON fields for allergens and nutritionalInfo
- Cart expiry is tracked via `expiresAt`; `cleanupAbandonedCarts` is the sweeper
- Coupon types: `fixed_amount` or `percentage`; anything richer (buy X get Y,
  tiers, automatic, free shipping) is a `Discount`
- Gift card codes are unique and auto-generated
- License keys follow XXXX-XXXX-XXXX-XXXX-XXXX format
- Software licensing (issue from a payment webhook, device activations, team
  seats, signed offline tokens, the desktop client) is `commerce.licensing`:
  read `stacks-licensing`
- Product dashboard is highlighted (`dashboard: { highlight: true }`)
- Default seeder counts: Product(10), Order(20), Review(50), Payment(50),
  GiftCard(20), Customer(20), Coupon(15)
- `fetchById` in most sub-modules returns the raw row, so columns arrive
  snake_cased even though the declared type is camelCase

## Downstream

> Touching a money path? `/stacks-tdd` for the seam to test it at, and
> `/stacks-review` before it merges. `/stacks-payments` covers the Stripe side.

## Input and inventory abstractions

`parseSalesTaxSetup(body, { maxRate?, maxRates? })` requires an explicit rates
array, rejects coerced prices/text and duplicate normalized component codes,
and accepts [] only as deliberate removal. HQ-style stores can set maxRate
to 30; the general default is 100. This validates configuration, not the legal
rate applicable to a sale. `parseTaxRateWriteData` is also used by native tax
store/update/bulk operations so false form booleans cannot select a default.

`restockedQuantity(current, units, maximum?)` adds positive whole units,
refusing untracked stock and overflow. `commerce.products.items.restock(id, units)`
uses that rule under a row lock and reads back on its own connection;
`updateInventory` validates absolute quantities through the same boundary.
Pure narrow entries are commerce/inventory and commerce/tax-input.
