---
name: stacks-commerce
description: Use when building e-commerce features in Stacks — the commerce namespace with 13 sub-modules (products, orders, customers, coupons, payments, shipping, tax, gift cards, waitlists, devices, receipts, restaurant), 20+ commerce models, default commerce functions, or the commerce configuration. Covers @stacksjs/commerce.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Commerce

Comprehensive e-commerce module with 13 sub-modules and 20+ models.

## Key Paths
- Core package: `storage/framework/core/commerce/src/`
- Default functions: `storage/framework/defaults/functions/commerce/`
- Default models: `storage/framework/defaults/app/Models/commerce/`

## Commerce Namespace

```typescript
import { commerce } from '@stacksjs/commerce'

// 13 sub-modules
commerce.products      // Product CRUD
commerce.coupons       // Coupon management
commerce.customers     // Customer management
commerce.errors        // Error tracking
commerce.giftCards     // Gift card management
commerce.orders        // Order management
commerce.payments      // Payment processing
commerce.restaurant    // Restaurant features
commerce.shippings     // Shipping management
commerce.tax           // Tax rate management
commerce.waitlists     // Waitlist management
commerce.devices       // Print device management
commerce.receipts      // Receipt management
```

## Sub-Module Operations

Each sub-module typically provides:
- `index()` — list all
- `fetch(id)` — get one
- `store(data)` — create
- `update(id, data)` — update
- `destroy(id)` — delete

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
- Commerce models are auto-generated — edit definitions, not generated files
- Use `buddy make:migration` when changing commerce schemas
- Order `observe: true` emits events on create/update/delete
- Products have JSON fields for allergens and nutritionalInfo
- Cart expiry is tracked via `expiresAt` field
- Coupon types: `fixed_amount` or `percentage`
- Gift card codes are unique and auto-generated
- License keys follow XXXX-XXXX-XXXX-XXXX-XXXX format
- Product dashboard is highlighted (`dashboard: { highlight: true }`)
- Default seeder counts: Product(10), Order(20), Review(50), Payment(50)
