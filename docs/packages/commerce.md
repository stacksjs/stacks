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
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
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
| `products.variants.*` | Variant operations |
| `products.categories.*` | Category operations |
| `products.reviews.*` | Review operations |

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
| `shippings.shippingMethods.*` | Shipping methods |
| `shippings.shippingZones.*` | Shipping zones |
| `shippings.shippingRates.*` | Rate calculations |
| `shippings.deliveryRoutes.*` | Delivery routes |
