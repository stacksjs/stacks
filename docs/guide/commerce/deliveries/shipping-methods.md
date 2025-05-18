# Shipping Methods

The Shipping Methods module in the Commerce package provides a comprehensive set of functions to manage and interact with your shipping method data. This guide will walk you through the various operations you can perform with shipping methods.

## Getting Started

First, import the shipping methods functionality from the Commerce package:

```ts
import { shippings } from '@stacksjs/commerce'
```

## Fetching Shipping Methods

The Commerce package provides several methods to fetch shipping methods:

### Fetch All Shipping Methods

```ts
const allShippingMethods = await shippings.methods.fetchAll()
```

### Fetch a Single Shipping Method

```ts
const shippingMethod = await shippings.methods.fetchById(1) // Replace 1 with the actual shipping method ID
```

### Get Active Shipping Methods

```ts
const activeShippingMethods = await shippings.methods.getActiveShippingMethods()
```

## Managing Shipping Methods

### Store a New Shipping Method

```ts
const newShippingMethod = await shippings.methods.store({
  name: 'Express Shipping',
  base_rate: 15.99,
  free_shipping: 100.00, // Free shipping threshold
  status: 'active',
  // ... other shipping method attributes
})
```

### Store Multiple Shipping Methods

```ts
const newShippingMethods = await shippings.methods.bulkStore([
  {
    name: 'Standard Shipping',
    base_rate: 5.99,
    free_shipping: 50.00,
    status: 'active',
  },
  {
    name: 'Next Day Delivery',
    base_rate: 25.99,
    status: 'active',
  },
])
```

### Update a Shipping Method

```ts
const updatedShippingMethod = await shippings.methods.update(1, {
  base_rate: 17.99,
  free_shipping: 120.00,
  status: 'active',
})
```

### Update Shipping Method Status

```ts
const updatedMethod = await shippings.methods.updateStatus(1, 'active')
```

### Update Pricing Information

```ts
const updatedPricing = await shippings.methods.updatePricing(1, 19.99, 150.00)
```

### Format Shipping Options

```ts
const shippingOptions = await shippings.methods.formatShippingOptions()
// Returns array of formatted options with id, name, status, and base_rate
```

### Delete Shipping Methods

Single shipping method deletion:
```ts
await shippings.methods.destroy(1) // Replace 1 with the shipping method ID to delete
```

Bulk deletion:
```ts
await shippings.methods.bulkDestroy([1, 2, 3]) // Array of shipping method IDs to delete
```

### Soft Delete

Single soft delete:
```ts
await shippings.methods.softDelete(1) // Marks the shipping method as inactive
```

Bulk soft delete:
```ts
await shippings.methods.bulkSoftDelete([1, 2, 3]) // Marks multiple shipping methods as inactive
```

## API Endpoints

The Shipping Methods module provides RESTful API endpoints for managing shipping methods. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/shipping-methods              # List all shipping methods
POST   /commerce/shipping-methods              # Create a new shipping method
POST   /commerce/shipping-methods/bulk         # Create multiple shipping methods
GET    /commerce/shipping-methods/{id}         # Get a specific shipping method
PATCH  /commerce/shipping-methods/{id}         # Update a shipping method
PATCH  /commerce/shipping-methods/{id}/status  # Update shipping method status
PATCH  /commerce/shipping-methods/{id}/pricing # Update shipping method pricing
DELETE /commerce/shipping-methods/{id}         # Delete a shipping method
DELETE /commerce/shipping-methods/bulk         # Delete multiple shipping methods
```

### Example Usage

```ts
// List all shipping methods
const response = await fetch('/commerce/shipping-methods')
const shippingMethods = await response.json()

// Create a new shipping method
const response = await fetch('/commerce/shipping-methods', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Express Shipping',
    base_rate: 15.99,
    free_shipping: 100.00,
    status: 'active',
  }),
})
const newShippingMethod = await response.json()

// Update shipping method pricing
const response = await fetch('/commerce/shipping-methods/1/pricing', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    base_rate: 17.99,
    free_shipping: 120.00,
  }),
})
const updatedPricing = await response.json()
```

### Response Format

A successful response includes the shipping method data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Express Shipping",
  "base_rate": 15.99,
  "free_shipping": 100.00,
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Shipping Methods module includes built-in error handling for common scenarios:

- Invalid shipping method IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Status updates are validated against allowed values
- Pricing updates are validated for correct numeric values

Example error handling in your code:

```ts
try {
  const shippingMethod = await shippings.methods.store({
    name: 'Express Shipping',
    base_rate: 15.99,
  })
} catch (error) {
  console.error('Failed to create shipping method:', error.message)
}
```

This documentation covers the basic operations available in the Shipping Methods module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
