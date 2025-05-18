# Waitlist Products

The Waitlist Products module in the Commerce package provides a comprehensive set of functions to manage product waitlists. This module helps you handle customer waitlists for products, track notifications, and manage conversions from waitlist to purchase.

## Getting Started

First, import the waitlist products functionality from the Commerce package:

```ts
import { waitlists } from '@stacksjs/commerce'
```

## Fetching Waitlist Products

The Commerce package provides several methods to fetch waitlist products:

### Fetch All Waitlist Products

```ts
const allWaitlistProducts = await waitlists.products.fetchAll()
```

### Fetch a Single Waitlist Product

```ts
const waitlistProduct = await waitlists.products.fetchById(1) // Replace 1 with the actual waitlist product ID
```

### Fetch by Status

```ts
// Fetch all waiting entries
const waitingProducts = await waitlists.products.fetchWaiting()

// Get count by status
const waitingCount = await waitlists.products.fetchCountByStatus('waiting')
```

### Fetch by Date Range

```ts
const startDate = new Date('2024-01-01')
const endDate = new Date('2024-12-31')

// Fetch entries between dates
const products = await waitlists.products.fetchBetweenDates(startDate, endDate)

// Fetch notified entries
const notifiedProducts = await waitlists.products.fetchNotifiedBetweenDates(startDate, endDate)

// Fetch purchased entries
const purchasedProducts = await waitlists.products.fetchPurchasedBetweenDates(startDate, endDate)

// Fetch cancelled entries
const cancelledProducts = await waitlists.products.fetchCancelledBetweenDates(startDate, endDate)
```

### Analytics and Reporting

```ts
// Get conversion rates
const conversionData = await waitlists.products.fetchConversionRates()

// Get counts by source
const sourceCounts = await waitlists.products.fetchCountBySource()

// Get counts by quantity
const quantityCounts = await waitlists.products.fetchCountByAllQuantities()

// Get daily counts
const dailyCounts = await waitlists.products.fetchCountByDateGrouped()
```

## Managing Waitlist Products

### Store a New Waitlist Product

```ts
const newWaitlistProduct = await waitlists.products.store({
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  quantity: 1,
  notification_preference: 'email',
  source: 'website',
  product_id: 123,
  customer_id: 456,
  status: 'waiting',
})
```

### Store Multiple Waitlist Products

```ts
const newWaitlistProducts = await waitlists.products.bulkStore([
  {
    name: 'John Doe',
    email: 'john@example.com',
    quantity: 1,
    product_id: 123,
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    quantity: 2,
    product_id: 124,
  },
])
```

### Update a Waitlist Product

```ts
const updatedWaitlistProduct = await waitlists.products.update(1, {
  name: 'John Doe Updated',
  email: 'john.updated@example.com',
  notification_preference: 'sms',
})
```

### Update Status

```ts
const updatedStatus = await waitlists.products.updateStatus(1, 'notified')
```

### Update Party Size

```ts
const updatedPartySize = await waitlists.products.updatePartySize(1, 3)
```

### Delete Waitlist Products

Single waitlist product deletion:
```ts
const deletedProduct = await waitlists.products.destroy(1) // Returns the deleted product
```

Bulk deletion:
```ts
const deletedCount = await waitlists.products.bulkDestroy([1, 2, 3]) // Returns number of products deleted
```

## API Endpoints

The Waitlist Products module provides RESTful API endpoints for managing waitlist products. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/waitlist/products              # List all waitlist products
POST   /commerce/waitlist/products              # Create a new waitlist product
POST   /commerce/waitlist/products/bulk         # Create multiple waitlist products
GET    /commerce/waitlist/products/{id}         # Get a specific waitlist product
PATCH  /commerce/waitlist/products/{id}         # Update a waitlist product
PATCH  /commerce/waitlist/products/{id}/status  # Update waitlist product status
PATCH  /commerce/waitlist/products/{id}/size    # Update party size
DELETE /commerce/waitlist/products/{id}         # Delete a waitlist product
DELETE /commerce/waitlist/products/bulk         # Delete multiple waitlist products
```

### Example Usage

```ts
// List all waitlist products
const response = await fetch('/commerce/waitlist/products')
const products = await response.json()

// Create a new waitlist product
const response = await fetch('/commerce/waitlist/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    quantity: 1,
    product_id: 123,
  }),
})
const newProduct = await response.json()

// Update waitlist product status
const response = await fetch('/commerce/waitlist/products/1/status', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'notified',
  }),
})
const updatedStatus = await response.json()
```

### Response Format

A successful response includes the waitlist product data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "quantity": 1,
  "notification_preference": "email",
  "source": "website",
  "notes": null,
  "status": "waiting",
  "product_id": 123,
  "customer_id": 456,
  "notified_at": null,
  "purchased_at": null,
  "cancelled_at": null,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Waitlist Products module includes built-in error handling for common scenarios:

- Invalid waitlist product IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Status updates are validated against allowed values ('waiting', 'notified', 'purchased', 'cancelled')
- Email and phone validations ensure proper format
- Quantity validations ensure positive numbers

Example error handling in your code:

```ts
try {
  const waitlistProduct = await waitlists.products.store({
    name: 'John Doe',
    email: 'john@example.com',
    quantity: 1,
    product_id: 123,
  })
} catch (error) {
  console.error('Failed to create waitlist product:', error.message)
}
```

This documentation covers the basic operations available in the Waitlist Products module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
