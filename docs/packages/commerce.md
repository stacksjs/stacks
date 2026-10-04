---
title: Commerce Package
description: "A comprehensive e-commerce solution providing products, orders, payments, shipping, inventory management, and customer handling capabilities."
---
# Commerce Package

A comprehensive e-commerce solution providing products, orders, payments, shipping, inventory management, and customer handling capabilities.

## Installation

```bash
bun add @stacksjs/commerce
```

## Basic Usage

```typescript
import { commerce } from '@stacksjs/commerce'

// Create a product
const product = await commerce.products.store({
  name: 'Premium Widget',
  price: 29.99,
  sku: 'WDG-001'
})

// Create an order
const order = await commerce.orders.store({
  customerId: 1,
  items: [{ productId: product.id, quantity: 2 }]
})
```

## Products

### Creating Products

```typescript
import { commerce } from '@stacksjs/commerce'

// Create a simple product
const product = await commerce.products.store({
  name: 'Basic T-Shirt',
  description: 'Comfortable cotton t-shirt',
  price: 19.99,
  compareAtPrice: 24.99, // Original price for sale display
  sku: 'TSH-001',
  barcode: '123456789',
  weight: 0.3,
  weightUnit: 'kg',
  status: 'active',
  taxable: true,
  inventory: {
    tracked: true,
    quantity: 100,
    lowStockThreshold: 10
  }
})
```

### Product Variants

```typescript
// Product with variants
const product = await commerce.products.store({
  name: 'Premium T-Shirt',
  price: 29.99,
  options: [
    { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    { name: 'Color', values: ['Red', 'Blue', 'Black'] }
  ]
})

// Create variants
await commerce.products.variants.store({
  productId: product.id,
  variants: [
    { options: { Size: 'S', Color: 'Red' }, sku: 'TSH-S-RED', price: 29.99, inventory: 25 },
    { options: { Size: 'M', Color: 'Red' }, sku: 'TSH-M-RED', price: 29.99, inventory: 50 },
    { options: { Size: 'L', Color: 'Blue' }, sku: 'TSH-L-BLU', price: 29.99, inventory: 30 }
  ]
})

// Fetch variants
const variants = await commerce.products.variants.fetch(product.id)
```

### Product Categories

```typescript
// Create category
const category = await commerce.products.categories.store({
  name: 'Clothing',
  slug: 'clothing',
  description: 'All clothing items',
  parentId: null
})

// Create subcategory
const subcategory = await commerce.products.categories.store({
  name: 'T-Shirts',
  slug: 't-shirts',
  parentId: category.id
})

// Assign product to category
await commerce.products.categories.assign(product.id, [category.id, subcategory.id])

// Fetch products by category
const products = await commerce.products.categories.fetch(category.id)
```

### Product Reviews

```typescript
// Create review
const review = await commerce.products.reviews.store({
  productId: product.id,
  customerId: customer.id,
  rating: 5,
  title: 'Great product!',
  body: 'Exactly what I was looking for.',
  verified: true
})

// Fetch reviews
const reviews = await commerce.products.reviews.fetch(product.id, {
  rating: 5,
  verified: true,
  sort: 'newest'
})

// Update review
await commerce.products.reviews.update(review.id, {
  status: 'approved'
})
```

### Product Manufacturers

```typescript
// Create manufacturer
const manufacturer = await commerce.products.manufacturers.store({
  name: 'Acme Corp',
  website: 'https://acme.com',
  contactEmail: 'sales@acme.com'
})

// Fetch products by manufacturer
const products = await commerce.products.manufacturers.fetch(manufacturer.id)
```

## Inventory

### Inventory Management

```typescript
// Update inventory
await commerce.products.units.update(variantId, {
  quantity: 150,
  location: 'warehouse-a'
})

// Adjust inventory
await commerce.products.units.adjust(variantId, {
  adjustment: -5,
  reason: 'damaged',
  notes: 'Items damaged in transit'
})

// Transfer inventory
await commerce.products.units.transfer({
  variantId,
  fromLocation: 'warehouse-a',
  toLocation: 'warehouse-b',
  quantity: 20
})

// Get inventory levels
const levels = await commerce.products.units.fetch(variantId)
```

### Low Stock Alerts

```typescript
// Get low stock products
const lowStock = await commerce.products.fetch({
  lowStock: true
})

// Configure alerts
await commerce.settings.update({
  lowStockThreshold: 10,
  lowStockNotifications: ['email', 'slack']
})
```

## Orders

### Creating Orders

```typescript
// Create order
const order = await commerce.orders.store({
  customerId: customer.id,
  email: 'customer@example.com',
  billingAddress: {
    firstName: 'John',
    lastName: 'Doe',
    address1: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US'
  },
  shippingAddress: {
    firstName: 'John',
    lastName: 'Doe',
    address1: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US'
  },
  items: [
    { variantId: 1, quantity: 2, price: 29.99 },
    { variantId: 2, quantity: 1, price: 49.99 }
  ],
  shippingMethod: 'standard',
  discountCode: 'SAVE10'
})
```

### Order Status

```typescript
// Update order status
await commerce.orders.update(order.id, {
  status: 'processing'
})

// Available statuses
// 'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'

// Fetch orders by status
const pendingOrders = await commerce.orders.fetch({
  status: 'pending'
})
```

### Order Fulfillment

```typescript
// Fulfill order
await commerce.orders.fulfill(order.id, {
  trackingNumber: '1Z999AA10123456784',
  carrier: 'ups',
  notifyCustomer: true
})

// Partial fulfillment
await commerce.orders.fulfillPartial(order.id, {
  items: [{ lineItemId: 1, quantity: 1 }],
  trackingNumber: '1Z999AA10123456784'
})
```

## Shopping Cart

### Cart Operations

```typescript
// Create cart
const cart = await commerce.carts.store({
  customerId: customer.id, // Optional for guest checkout
  currency: 'USD'
})

// Add item to cart
await commerce.carts.addItem(cart.id, {
  variantId: 1,
  quantity: 2
})

// Update cart item
await commerce.carts.updateItem(cart.id, lineItemId, {
  quantity: 3
})

// Remove item from cart
await commerce.carts.removeItem(cart.id, lineItemId)

// Get cart
const cartData = await commerce.carts.fetch(cart.id)
console.log(cartData.subtotal)  // 89.97
console.log(cartData.total)     // 97.47 (with tax/shipping)

// Clear cart
await commerce.carts.clear(cart.id)
```

### Cart Discounts

```typescript
// Apply discount code
await commerce.carts.applyDiscount(cart.id, 'SAVE10')

// Remove discount
await commerce.carts.removeDiscount(cart.id, 'SAVE10')

// Get applied discounts
const discounts = await commerce.carts.getDiscounts(cart.id)
```

## Payments

### Processing Payments

```typescript
// Create payment
const payment = await commerce.payments.store({
  orderId: order.id,
  amount: order.total,
  currency: 'USD',
  method: 'stripe',
  metadata: {
    stripePaymentIntentId: 'pi_123456'
  }
})

// Capture payment
await commerce.payments.capture(payment.id)

// Refund payment
await commerce.payments.refund(payment.id, {
  amount: 29.99,
  reason: 'customer_request',
  notifyCustomer: true
})

// Partial refund
await commerce.payments.refund(payment.id, {
  amount: 15.00,
  lineItems: [{ lineItemId: 1, quantity: 1 }]
})
```

### Payment Methods

```typescript
// Fetch payments for order
const payments = await commerce.payments.fetch({
  orderId: order.id
})

// Payment statuses
// 'pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'
```

## Customers

### Customer Management

```typescript
// Create customer
const customer = await commerce.customers.store({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  acceptsMarketing: true,
  tags: ['vip', 'wholesale']
})

// Update customer
await commerce.customers.update(customer.id, {
  tags: ['vip', 'wholesale', 'repeat-buyer']
})

// Fetch customer with orders
const customerData = await commerce.customers.fetch(customer.id, {
  include: ['orders', 'addresses']
})

// Customer addresses
await commerce.customers.addAddress(customer.id, {
  type: 'shipping',
  default: true,
  address: {
    firstName: 'John',
    lastName: 'Doe',
    address1: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US'
  }
})
```

## Coupons and Discounts

### Creating Coupons

```typescript
// Create percentage discount
const coupon = await commerce.coupons.store({
  code: 'SAVE20',
  type: 'percentage',
  value: 20,
  minimumPurchase: 50.00,
  usageLimit: 100,
  startsAt: new Date('2024-01-01'),
  expiresAt: new Date('2024-12-31'),
  applicableTo: 'all' // 'all', 'products', 'categories'
})

// Create fixed amount discount
const fixedCoupon = await commerce.coupons.store({
  code: 'FLAT10',
  type: 'fixed',
  value: 10.00,
  minimumPurchase: 30.00
})

// Create free shipping coupon
const shippingCoupon = await commerce.coupons.store({
  code: 'FREESHIP',
  type: 'free_shipping',
  minimumPurchase: 75.00
})

// Create buy-one-get-one
const bogoCoupon = await commerce.coupons.store({
  code: 'BOGO',
  type: 'buy_x_get_y',
  buyQuantity: 2,
  getQuantity: 1,
  getDiscountPercent: 100 // Free
})
```

### Validating Coupons

```typescript
// Validate coupon
const validation = await commerce.coupons.validate('SAVE20', {
  customerId: customer.id,
  cartTotal: 75.00,
  items: cartItems
})

if (validation.valid) {
  console.log(`Discount: $${validation.discount}`)
} else {
  console.log(`Invalid: ${validation.reason}`)
}
```

## Gift Cards

```typescript
// Create gift card
const giftCard = await commerce.giftCards.store({
  initialValue: 100.00,
  currency: 'USD',
  recipientEmail: 'recipient@example.com',
  senderName: 'John',
  message: 'Happy Birthday!'
})

// Check balance
const balance = await commerce.giftCards.balance(giftCard.code)

// Redeem gift card
await commerce.giftCards.redeem(giftCard.code, {
  orderId: order.id,
  amount: 50.00
})

// Fetch gift cards
const cards = await commerce.giftCards.fetch({
  status: 'active'
})
```

## Shipping

### Shipping Methods

```typescript
// Create shipping method
const shippingMethod = await commerce.shippings.shippingMethods.store({
  name: 'Standard Shipping',
  description: '5-7 business days',
  price: 9.99,
  freeAbove: 75.00,
  estimatedDays: { min: 5, max: 7 }
})

// Create shipping zone
const zone = await commerce.shippings.shippingZones.store({
  name: 'United States',
  countries: ['US'],
  methods: [shippingMethod.id]
})
```

### Shipping Rates

```typescript
// Calculate shipping rates
const rates = await commerce.shippings.shippingRates.calculate({
  destination: {
    postalCode: '10001',
    country: 'US'
  },
  items: cartItems,
  weight: 2.5
})

// Returns available shipping options with prices
```

### Delivery Routes

```typescript
// Create delivery route
const route = await commerce.shippings.deliveryRoutes.store({
  name: 'Local Delivery',
  areas: ['10001', '10002', '10003'],
  price: 5.99,
  estimatedTime: '2-4 hours'
})

// Fetch routes
const routes = await commerce.shippings.deliveryRoutes.fetch({
  postalCode: '10001'
})
```

### Digital Delivery

```typescript
// Create digital product delivery
const delivery = await commerce.shippings.digitalDeliveries.store({
  orderId: order.id,
  type: 'download',
  fileUrl: 'https://cdn.example.com/files/ebook.pdf',
  expiresAt: new Date(Date.now() + 7 _ 24 _ 60 _ 60 _ 1000) // 7 days
})

// Create license key delivery
const license = await commerce.shippings.licenseKeys.store({
  productId: product.id,
  key: 'XXXX-XXXX-XXXX-XXXX',
  type: 'perpetual'
})
```

## Tax

### Tax Configuration

```typescript
// Create tax rate
const taxRate = await commerce.tax.store({
  name: 'NY Sales Tax',
  rate: 8.875,
  country: 'US',
  state: 'NY',
  taxable: 'all' // 'all', 'physical', 'digital'
})

// Fetch applicable tax
const tax = await commerce.tax.calculate({
  country: 'US',
  state: 'NY',
  postalCode: '10001',
  items: cartItems
})
```

## Receipts

```typescript
// Generate receipt
const receipt = await commerce.receipts.store({
  orderId: order.id,
  type: 'invoice'
})

// Export receipt as PDF
const pdf = await commerce.receipts.export(receipt.id, 'pdf')

// Email receipt
await commerce.receipts.send(receipt.id, {
  email: customer.email
})
```

## Waitlists

### Product Waitlist

```typescript
// Add to waitlist
await commerce.waitlists.products.store({
  productId: product.id,
  variantId: variant.id,
  customerId: customer.id,
  email: 'customer@example.com',
  notifyWhenAvailable: true
})

// Notify waitlist (when back in stock)
await commerce.waitlists.products.notify(product.id)

// Fetch waitlist
const waitlist = await commerce.waitlists.products.fetch(product.id)
```

### Restaurant Waitlist

```typescript
// Add to restaurant waitlist
await commerce.waitlists.restaurant.store({
  partySize: 4,
  customerName: 'John Doe',
  phone: '+1234567890',
  preferredTime: new Date('2024-01-15 19:00'),
  notes: 'Anniversary dinner'
})

// Update position
await commerce.waitlists.restaurant.update(waitlistId, {
  status: 'seated'
})
```

## Devices (POS)

```typescript
// Register POS device
const device = await commerce.devices.store({
  name: 'Store #1 Register',
  type: 'pos',
  location: 'Main Store'
})

// Update device status
await commerce.devices.update(device.id, {
  status: 'online',
  lastSeen: new Date()
})

// Fetch devices
const devices = await commerce.devices.fetch({
  status: 'online'
})
```

## Importing a Catalog

Move an existing store's catalog into the commerce tables with one command. It reads the platform's public storefront API, so no credentials are needed:

```bash
# Shopify: reads https://<store>/products.json
buddy commerce:import https://shop.example.com --from shopify --dry-run
buddy commerce:import https://shop.example.com --from shopify

# WooCommerce 6+: reads the Store API at /wp-json/wc/store/v1/products
buddy commerce:import https://example.com/shop --from woocommerce --limit 50

# Shopware 6: reads the Store API at /store-api/product
buddy commerce:import https://shop.example.de --from shopware --access-key SWSC... --dry-run
SHOPWARE_ACCESS_KEY=SWSC... buddy commerce:import https://shop.example.de --from shopware
```

| Flag | Meaning |
|------|---------|
| `--from <platform>` | `shopify`, `woocommerce` or `shopware` (required) |
| `--access-key <key>` | Shopware only, and required there: the sales channel access key. `SHOPWARE_ACCESS_KEY` works too; the flag wins |
| `--dry-run` | Print what would be created or updated, write nothing |
| `--limit <count>` | Stop after this many products |
| `--currency <code>` | The store currency, when the store does not report it (Shopify `/meta.json`, Shopware `/store-api/context`) |

### Shopware 6

Shopware's Store API answers only requests that carry a sales channel access key in the `sw-access-key` header. The key is public by design: every headless storefront ships it in its page source, and it only selects which sales channel answers, so it reads exactly what an anonymous shopper can see. Find it in the Shopware Administration under **Sales Channels**: open the storefront or headless sales channel and copy the key from its **API access** card. It starts with `SWSC`; a key starting with `SWIA` belongs to an Admin API integration and is refused. You can pass the storefront URL or the API endpoint (`https://shop.example.de/store-api`).

- **Prices** are `calculatedPrice.unitPrice`: the price one unit costs in the sales channel's currency, gross for a B2C channel, as a shopper sees it. The list price becomes the compare-at price when it is higher. The JSON number is converted through its decimal string, never multiplied as a float, so `19.99` is `1999`.
- **Currency** comes from `/store-api/context`. The Store API cannot convert, so a `--currency` that contradicts the sales channel is ignored with a warning; it only fills in when the context does not report one.
- **Variants** are Shopware's child products. Each becomes a `product_variants` row with the child's product number as `sku`, its own price and list price, its available stock as `inventory_count` (oversold, negative stock reads as 0), and its option values in the property groups' order. A parent whose variants are all hidden from the sales channel is imported without a price, with a warning.
- **Names and descriptions** use the sales channel's language (`translated`), falling back to the default-language fields. The first category is the product's SEO category when the channel has one.

What lands where:

- **Products**: name, HTML description, the lowest variant price (integer minor units), availability, and the first image URL (images are not downloaded).
- **Variants**: one `product_variants` row per real option combination. Option values go in `options`, and the SKU, price, compare-at price and stock (when the source exposes it) go in `sku`, `price`, `compare_at_price` and `inventory_count`, money in integer minor units. A SKU is unique per product, so a source variant repeating one is imported without it, with a warning.
- **Categories**: the Shopify product type, or the first WooCommerce or Shopware category, matched by slug.
- **Manufacturers**: the Shopify vendor, the WooCommerce brand, or the Shopware manufacturer, matched by name.

Re-running is safe. Each imported product and variant gets a `uuid` derived from the store host and the source id, so a second run updates the rows the first one wrote instead of duplicating them. Columns you own on the Stacks side (`preparation_time`, `allergens`, `nutritional_info`, a variant's `description`) are never overwritten, and neither is a stock count or variant SKU the source does not report.

Prices are stored in the source store's currency. `products.price` has no currency column, so the command warns when that differs from `currency` in `config/commerce.ts`.

The catalog import reads public storefront APIs only, so it never sees customers or orders; import those with `--customers` and `--orders` (below). Reviews, exact stock levels (Shopify and WooCommerce), Shopify collections and redirects are not imported.

### Customers and orders

Customers and orders live behind each platform's admin API, so importing them needs credentials. They are read **from the environment only** (or `.env`, which `buddy` loads), never from a flag, where they would land in shell history and `ps` output:

| Platform | Env vars | Where to create them |
|----------|----------|----------------------|
| Shopify | `SHOPIFY_ADMIN_TOKEN` | A custom app for the store (Shopify admin > Settings > Apps > Develop apps, or the Dev Dashboard) with the `read_customers` and `read_orders` scopes, plus `read_all_orders` for orders older than 60 days. The token starts with `shpat_` |
| WooCommerce | `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET` | WordPress admin > WooCommerce > Settings > Advanced > REST API > Add key, with **Read** permission (`ck_...` / `cs_...`) |
| Shopware 6 | `SHOPWARE_CLIENT_ID`, `SHOPWARE_CLIENT_SECRET` | Administration > Settings > System > Integrations, with a role that can read customers and orders. The access key id (`SWIA...`) is the client id |

```bash
# Customers and orders, without the catalog
SHOPIFY_ADMIN_TOKEN=shpat_... buddy commerce:import https://shop.example.com --from shopify \
  --customers --orders --admin-url northwind.myshopify.com --dry-run

# Everything: catalog first, then customers, then orders (their lines link to the products)
buddy commerce:import https://example.com/shop --from woocommerce --catalog --customers --orders

# Shopware: the integration credentials for customers and orders, the access key for the catalog
buddy commerce:import https://shop.example.de --from shopware --orders --limit 100
```

| Flag | Meaning |
|------|---------|
| `--customers` | Import customers from the admin API |
| `--orders` | Import orders and their lines from the admin API |
| `--catalog` | Import the catalog as well. It is the default when neither `--customers` nor `--orders` is given |
| `--admin-url <url>` | The admin API address when it differs from `<url>`. Shopify's Admin API answers on `https://<store>.myshopify.com`, so pass it for a store on a custom domain. Identities always come from `<url>`, so pass the same `<url>` you imported the catalog with |
| `--limit <count>` | At most this many products, customers and orders, each |
| `--currency <code>` | The currency of an order that does not name one (all three platforms normally do) |

A missing credential fails before any request, naming the variables and where to create them. A `401` or `403` names the URL, says whether the credential was rejected or lacks a permission, and never repeats a secret, even one a server echoes back. WooCommerce keys go over HTTP Basic auth, so a store URL that is not `https://` is refused (WooCommerce itself only accepts Basic auth over HTTPS); Shopify and Shopware are HTTPS only too, except a Shopware on `localhost`. A Shopify `429` is retried after the `Retry-After` it sends, up to five times.

How each platform is read:

- **Shopify**: Admin REST API `2026-10`, `/admin/api/2026-10/customers.json` and `/orders.json?status=any` (the default is open orders only), 250 per page, following the `page_info` cursor in each response's `Link` header. Shopify marked the REST Admin API legacy in 2024 but keeps serving it to custom apps.
- **WooCommerce**: REST API v3, `/wp-json/wc/v3/customers` and `/orders`, 100 per page in id order, until `X-WP-TotalPages`. Order drafts (`checkout-draft`) are skipped.
- **Shopware**: `POST /api/oauth/token` with the `client_credentials` grant, then `POST /api/search/customer` and `/api/search/order` with `page`/`limit` criteria, the order's `lineItems`, `addresses`, `deliveries`, `transactions` and `currency` as associations, and `includes` limiting every entity to the fields the import reads. A token that expires mid-import is renewed once.

What lands where:

- **Customers**: `customers.email` (trimmed and lowercased), `name` (first and last name, else the email), `phone`, and `total_spent` (integer minor units) and `last_order` when the source reports them (Shopify spend, Shopware spend and last order date). The order import also moves `last_order` forward, never back, to the latest order it links to each customer, which is how WooCommerce customers get one at all. A disabled Shopware account is `Inactive`. A new customer gets the default avatar, or a WooCommerce Gravatar. No password hash and no payment data is ever requested or written: the importer has no field for either. Addresses are not imported as records, since there is no address model; an order's shipping address is kept on the order.
- **Deduplication**: a customer is matched first by the `uuid` an earlier import gave it (derived from the source id, so a changed email follows the customer), then by email, case-insensitively. A customer who already exists in Stacks, from a checkout or another store, is updated, not duplicated, and keeps its own `uuid` and avatar. Shopware's per-checkout guest accounts that share an email become one customer. A WooCommerce guest is known by email only; once the same address has an account at the source, the guest's row takes the account's `uuid`, so a later change of address there updates it instead of creating a second customer.
- **Orders**: `orders.uuid` derived from the source order id; `currency` per order, with `total_amount`, `tax_amount`, `discount_amount`, `delivery_fee` (shipping) and `tip_amount` in integer minor units of that currency, converted through decimal strings, never floats. `delivery_address` is the shipping address on one line, `special_instructions` the customer's note, `created_at` the date the order was placed. `order_type` is `DELIVERY` for an order with a shipping address and `TAKEOUT` otherwise. The order is linked to the customer with its email; a guest, or a customer not imported yet, is created from the order. Writes bypass the models, so importing history sends no order emails and fires no `order:*` events.
- **Order lines**: one `order_items` row per line, with `quantity` and the unit `price` before order-level discounts (WooCommerce's line subtotal over its quantity, rounded half up to the minor unit when it does not divide). `product_id` is the product the catalog import wrote, found through the same deterministic identities (the variant's when the line names one). `order_items` has no name, SKU or variant column, so the line's label and SKU are kept in its `special_instructions` (`Organic Cotton Tee - S / Black (SKU TEE-S-BLK)`). Discount lines (Shopware promotions, negative WooCommerce fees) count toward `discount_amount` instead; positive WooCommerce fees become lines without a product. A Shopware variant's label gets its options (`Bio T-Shirt - Blau, M`), since Shopware labels every variant with the parent's name.
- **Products not imported yet**: the line is kept, with its label, SKU and price but no `product_id`, and the import warns with a count and examples. Import the catalog and re-run the order import: re-running replaces each imported order's lines, so they link.
- **Lines with no product at the source**: a fee, a custom item, or a product deleted since the sale (WooCommerce reports `product_id` 0, Shopware a null `productId`) is kept the same way, but counted apart in the summary and not warned about: no catalog import can link it.
- **Refunds**: `orders` has no refund column, so `total_amount` stays what was charged. A fully refunded order is `REFUNDED`; a WooCommerce order refunded in part keeps its status, its line in the output says how much was refunded, and the import warns with a count and examples. Shopify and Shopware partial refunds are not read yet.

Statuses map onto the `OrderStatus` vocabulary (`PENDING`, `PROCESSING`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `REFUNDED`):

| Source | Mapping |
|--------|---------|
| Shopify | refunded: `REFUNDED`; cancelled, voided or restocked: `CANCELLED`; fulfilled: `SHIPPED` (Shopify does not track delivery); partially fulfilled, paid, partially paid or authorized: `PROCESSING`; pending: `PENDING` |
| WooCommerce | `pending`, `on-hold`: `PENDING`; `processing`: `PROCESSING`; `completed`: `DELIVERED`; `cancelled`, `failed`: `CANCELLED`; `refunded`: `REFUNDED` |
| Shopware | latest payment refunded: `REFUNDED`; order cancelled: `CANCELLED`; completed: `DELIVERED`; open or in progress with the delivery shipped: `SHIPPED`; in progress, partially shipped, or paid or authorized: `PROCESSING`; otherwise `PENDING` |

Any other status (a plugin's custom WooCommerce status, say) is imported as `PENDING`, with a warning naming it.

The commerce bundle has to be enabled (`enabled: true` in `config/commerce.ts`, or `buddy commerce:install`) and migrated, or there are no tables to write to; the command says so before the first request. `--dry-run` works without it.

Re-running is safe: customers and orders are matched as above, so a second run updates every row and creates none, and an order's lines are replaced rather than appended. `--dry-run` reads the database and reports what would be created or updated without writing; since it writes no products, a dry run that also imports the catalog matches order lines only against products already in Stacks. The order number (`#1001`) is shown in the output but not stored: `orders` has no column for it.

To add another platform, implement a `CatalogAdapter` (a pure payload mapper plus a pager) and register it in `catalogAdapters`; for customers and orders, an `AccountAdapter` registered in `accountAdapters`:

```typescript
import { catalogImport } from '@stacksjs/commerce'

const result = await catalogImport.importCatalog({
  adapter: catalogImport.catalogAdapter('shopify')!,
  storeUrl: 'https://shop.example.com',
  repository: catalogImport.createDatabaseRepository(),
  limit: 10,
})

console.log(result.counts.products) // { created: 10, updated: 0 }

const orders = await catalogImport.importOrders({
  adapter: catalogImport.accountAdapter('shopify')!,
  storeUrl: 'https://shop.example.com',
  adminUrl: 'https://northwind.myshopify.com',
  credentials: catalogImport.readAccountCredentials('shopify', process.env),
  repository: catalogImport.createDatabaseAccountRepository(),
})

console.log(orders.counts.lines) // { linked: 41, unlinked: 0, productless: 2 }
```

## Edge Cases

### Handling Inventory Conflicts

```typescript
try {
  await commerce.orders.store({
    items: [{ variantId: 1, quantity: 100 }]
  })
} catch (error) {
  if (error.code === 'INSUFFICIENT_INVENTORY') {
    const available = error.availableQuantity
    console.log(`Only ${available} items available`)
  }
}
```

### Price Calculation

```typescript
// Always use the commerce calculation methods
const totals = await commerce.calculateTotals({
  items: cartItems,
  shippingMethod: 'standard',
  discountCode: 'SAVE10',
  taxAddress: shippingAddress
})

console.log(totals.subtotal)
console.log(totals.discount)
console.log(totals.shipping)
console.log(totals.tax)
console.log(totals.total)
```

## API Reference

### Products

| Method | Description |
|--------|-------------|
| `products.store(data)` | Create product |
| `products.fetch(filters)` | List products |
| `products.update(id, data)` | Update product |
| `products.destroy(id)` | Delete product |
| `products.variants._` | Variant operations |
| `products.categories._` | Category operations |
| `products.reviews._` | Review operations |

### Orders

| Method | Description |
|--------|-------------|
| `orders.store(data)` | Create order |
| `orders.fetch(filters)` | List orders |
| `orders.update(id, data)` | Update order |
| `orders.fulfill(id, data)` | Fulfill order |
| `orders.cancel(id)` | Cancel order |

### Payments

| Method | Description |
|--------|-------------|
| `payments.store(data)` | Create payment |
| `payments.capture(id)` | Capture payment |
| `payments.refund(id, data)` | Refund payment |

### Shipping

| Method | Description |
|--------|-------------|
| `shippings.shippingMethods._` | Shipping methods |
| `shippings.shippingZones._` | Shipping zones |
| `shippings.shippingRates._` | Rate calculations |
| `shippings.deliveryRoutes.*` | Delivery routes |
