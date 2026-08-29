---
name: stacks-commerce
description: Use when building e-commerce features in Stacks - the commerce namespace with 15 sub-modules (products, carts, orders, customers, coupons, payments, gift cards, auctions, shipping, tax, waitlists, restaurant, devices, receipts, errors), 20+ commerce models, checkout and redemption logic, or the commerce configuration. Covers @stacksjs/commerce.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Commerce

Comprehensive e-commerce module with 15 sub-modules and 20+ models.

## Key Paths
- Core package: `storage/framework/core/commerce/src/`
- Default functions: `storage/framework/defaults/functions/commerce/`
- Default models: `storage/framework/defaults/app/Models/commerce/`

## Commerce Namespace

```typescript
import { commerce } from '@stacksjs/commerce'

// 15 sub-modules
commerce.products      // Products, variants, units, manufacturers, reviews, categories
commerce.carts         // The pre-checkout basket
commerce.orders        // Orders, order items, export, checkout guards
commerce.customers     // Customer records
commerce.coupons       // Coupons, including atomic redemption
commerce.payments      // Payment records, refunds
commerce.giftCards     // Gift cards, balance, redemption and reload
commerce.auctions      // Benefit auctions: lots, bids, proxy bidding, pledges
commerce.shippings     // Methods, rates, zones, routes, drivers, live tracking
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
- Drivers
- Digital deliveries
- License keys
- **Live tracking** (`commerce.shippings.tracking`) - see below

## Commerce Models (20+)

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| Product | name, price, inventoryCount, allergens(JSON) | belongsTo: Category, Manufacturer; hasMany: Review, ProductUnit, ProductVariant |
| ProductVariant | SKU, options, pricing | belongsTo: Product |
| ProductUnit | unit pricing | belongsTo: Product |
| Category | name, slug, isActive, displayOrder | hasMany: Product |
| Cart | status, total, currency(USD), expiresAt | hasMany: CartItem; belongsTo: Customer |
| CartItem | quantity, unitPrice, totalPrice | belongsTo: Cart |
| Order | status, totalAmount, orderType, deliveryAddress | hasMany: OrderItem, Payment; belongsTo: Customer |
| OrderItem | quantity, price | belongsTo: Order, Product |
| Coupon | code(unique), discountType, discountValue, usageLimit | hasMany: Order |
| GiftCard | code(unique), initialBalance, currentBalance, isReloadable | belongsTo: Customer |
| Customer | name, email, totalSpent, status | hasMany: Order, GiftCard, Review, Payment |
| Manufacturer | manufacturer info | hasMany: Product |
| Review | rating(1-5), content, isVerifiedPurchase, helpfulVotes | belongsTo: Product, Customer |
| ShippingRate | weightFrom, weightTo, rate | belongsTo: ShippingMethod, ShippingZone |
| DeliveryRoute | stops, totalDistance, status(planned/active/completed), startedAt | belongsTo: Driver; hasMany: DeliveryStop, DriverPing |
| DeliveryStop | sequence, status, address, latitude, longitude, etaAt, arrivedAt | belongsTo: DeliveryRoute, Order |
| Driver | name, phone, vehicleNumber, status, latitude, longitude, heading, lastPingAt | hasMany: DeliveryRoute, DriverPing |
| DriverPing | latitude, longitude, heading, speed, accuracy, recordedAt | belongsTo: Driver, DeliveryRoute |
| TaxRate | name, rate(0-100), type(VAT/GST/Sales Tax) | |
| LicenseKey | key(XXXX-XXXX-XXXX-XXXX-XXXX), template, status | belongsTo: Customer, Product, Order |
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

`redeem` bumps `usage_count` and enforces `max_uses`, `is_active` and the
start/end dates in the WHERE clause, so the database decides the race. A
`max_uses` of `NULL` means unlimited. Do not fetch, check and then call
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

// One call per position fix from the driver's device.
await tracking.recordDriverPing({
  driverId, latitude, longitude, speed, accuracy,
})

await tracking.completeStop(stop.id)   // order -> DELIVERED, route closes itself
```

### What `recordDriverPing` does

One entry point, so a tracking page never shows a position its ETA disagrees
with. Per fix it: appends to `driver_pings`, updates the driver's denormalised
present position, recomputes the served stop's ETA, broadcasts the position,
and latches `delivery:nearby` / `delivery:arrived` so each fires exactly once.

A fix reporting worse than 250m accuracy is stored but does not move the driver
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
driver rather than `Infinity`.

## Integration with Payments
Commerce works with `@stacksjs/payments` for Stripe integration:
```typescript
import { Payment } from '@stacksjs/payments'
await Payment.charge(customer, order.totalAmount, paymentMethodId)
```

## Dashboard Routes
All commerce models have dashboard views at `/dashboard/commerce/*`.

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

Use `insertedId(result)` from `utils/inserted-id`. Drivers disagree: SQLite
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
- Coupon types: `fixed_amount` or `percentage`
- Gift card codes are unique and auto-generated
- License keys follow XXXX-XXXX-XXXX-XXXX-XXXX format
- Product dashboard is highlighted (`dashboard: { highlight: true }`)
- Default seeder counts: Product(10), Order(20), Review(50), Payment(50),
  GiftCard(20), Customer(20), Coupon(15)
- `fetchById` in most sub-modules returns the raw row, so columns arrive
  snake_cased even though the declared type is camelCase

## Downstream

> Touching a money path? `/stacks-tdd` for the seam to test it at, and
> `/stacks-review` before it merges. `/stacks-payments` covers the Stripe side.
