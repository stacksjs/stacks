# Orders

The Orders module in the Commerce package provides a robust set of functions to manage and interact with your order data. This guide will walk you through the various operations you can perform with orders.

## Getting Started

First, import the orders functionality from the Commerce package:

```ts
import { orders } from '@stacksjs/commerce'
```

## Fetching Orders

The Commerce package provides several methods to fetch orders:

### Fetch All Orders

```ts
const allOrders = await orders.fetchAll()
// Optionally limit the number of orders
const limitedOrders = await orders.fetchAll(10)
```

### Fetch Recent Orders

```ts
const recentOrders = await orders.fetchRecent(10) // Get last 10 orders
```

### Fetch a Single Order

```ts
const order = await orders.fetchById(1) // Replace 1 with the actual order ID
```

### Fetch Order Statistics

```ts
const stats = await orders.fetchStats()
```

### Compare Orders by Period

```ts
const comparison = await orders.compareOrdersByPeriod(30) // Compare last 30 days
```

### Calculate Order Metrics

```ts
const metrics = await orders.calculateOrderMetrics(30) // Last 30 days
```

### Fetch Daily Order Trends

```ts
const trends = await orders.fetchDailyOrderTrends(30) // Last 30 days
```

## Managing Orders

### Store a New Order

```ts
const newOrder = await orders.store({
  customer_id: 1,
  total_amount: 99.99,
  status: 'PENDING',
  order_type: 'STANDARD',
  // ... other order attributes
})
```

### Update an Order

```ts
const updatedOrder = await orders.update(1, {
  total_amount: 149.99,
  status: 'PROCESSING',
})
```

### Update Order Status

```ts
const updatedOrder = await orders.updateStatus(1, 'SHIPPED')
```

### Update Delivery Information

```ts
const updatedOrder = await orders.updateDeliveryInfo(1, {
  delivery_address: '123 Main St',
  estimated_delivery_time: '2024-03-15',
})
```

### Delete Orders

Single order deletion:
```ts
await orders.destroy(1) // Replace 1 with the order ID to delete
```

Soft delete (marks as CANCELED):
```ts
await orders.softDelete(1) // Replace 1 with the order ID to soft delete
```

Bulk deletion:
```ts
await orders.bulkDestroy([1, 2, 3]) // Array of order IDs to delete
```

Bulk soft delete:
```ts
await orders.bulkSoftDelete([1, 2, 3]) // Array of order IDs to soft delete
```

## Exporting Orders

The module provides functions for exporting order data:

```ts
// Download orders
await orders.downloadOrders()

// Export orders
await orders.exportOrders()

// Store orders export
await orders.storeOrdersExport()
```

## API Endpoints

The Orders module provides RESTful API endpoints for managing orders. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/orders              # List all orders
POST   /commerce/orders              # Create a new order
GET    /commerce/orders/{id}         # Get a specific order
PATCH  /commerce/orders/{id}         # Update an order
DELETE /commerce/orders/{id}         # Delete an order
GET    /commerce/orders/stats        # Get order statistics
GET    /commerce/orders/metrics      # Get order metrics
GET    /commerce/orders/trends       # Get daily order trends
GET    /commerce/orders/export       # Export orders
```

### Example Usage

```ts
// List all orders
const response = await fetch('/commerce/orders')
const orders = await response.json()

// Create a new order
const response = await fetch('/commerce/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    customer_id: 1,
    total_amount: 99.99,
    status: 'PENDING',
    order_type: 'STANDARD',
  }),
})
const newOrder = await response.json()

// Get a specific order
const response = await fetch('/commerce/orders/1')
const order = await response.json()

// Update an order
const response = await fetch('/commerce/orders/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'PROCESSING',
    total_amount: 149.99,
  }),
})
const updatedOrder = await response.json()

// Delete an order
await fetch('/commerce/orders/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the order data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": 1,
  "total_amount": 99.99,
  "status": "PENDING",
  "order_type": "STANDARD",
  "delivery_address": "123 Main St",
  "estimated_delivery_time": "2024-03-15T00:00:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z",
  "items": [
    {
      "id": 1,
      "order_id": 1,
      "product_id": 1,
      "quantity": 2,
      "price": 49.99
    }
  ]
}
```

## Error Handling

The Orders module includes built-in error handling for common scenarios:

- Attempting to update or delete a non-existent order will throw an appropriate error
- Invalid order status updates will throw an error
- All database operations are wrapped in try-catch blocks to provide meaningful error messages
- Soft delete operations ensure order history is maintained while marking orders as canceled

This documentation covers the basic operations available in the Orders module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
