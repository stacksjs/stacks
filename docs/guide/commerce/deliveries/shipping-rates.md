# Shipping Rates

The Shipping Rates module in the Commerce package provides a comprehensive set of functions to manage and interact with your shipping rates. This module allows you to define specific rates based on shipping zones, methods, and weight ranges.

## Getting Started

First, import the shipping rates functionality from the Commerce package:

```ts
import { shippings } from '@stacksjs/commerce'
```

## Fetching Shipping Rates

The Commerce package provides several methods to fetch shipping rates:

### Fetch All Shipping Rates

```ts
const allShippingRates = await shippings.rates.fetchAll()
```

### Fetch a Single Shipping Rate

```ts
const shippingRate = await shippings.rates.fetchById(1) // Replace 1 with the actual shipping rate ID
```

### Get Rates by Zone

```ts
const zoneRates = await shippings.rates.getRatesByZone('north-america')
```

### Get Rates by Method

```ts
const methodRates = await shippings.rates.getShippingRatesByMethod('express')
```

### Get Rate by Weight and Zone

```ts
const rate = await shippings.rates.getRateByWeightAndZone(5.5, 'north-america')
```

### Format Rate Options

```ts
const rateOptions = await shippings.rates.formatShippingRateOptions()
// Returns array of formatted options with id, method, zone, and rate
```

## Managing Shipping Rates

### Store a New Shipping Rate

```ts
const newShippingRate = await shippings.rates.store({
  method: 'express',
  zone: 'north-america',
  weight_from: 0,
  weight_to: 5,
  rate: 15.99,
  handling_fee: 2.00,
  // ... other shipping rate attributes
})
```

### Store Multiple Shipping Rates

```ts
const newShippingRates = await shippings.rates.bulkStore([
  {
    method: 'standard',
    zone: 'north-america',
    weight_from: 0,
    weight_to: 5,
    rate: 9.99,
  },
  {
    method: 'standard',
    zone: 'north-america',
    weight_from: 5.1,
    weight_to: 10,
    rate: 14.99,
  },
])
```

### Update a Shipping Rate

```ts
const updatedShippingRate = await shippings.rates.update(1, {
  rate: 17.99,
  handling_fee: 2.50,
})
```

### Update Multiple Shipping Rates

```ts
const updates = [
  {
    id: 1,
    data: { rate: 17.99 },
  },
  {
    id: 2,
    data: { rate: 22.99 },
  },
]
const updatedCount = await shippings.rates.bulkUpdate(updates)
```

### Update Rates by Zone

```ts
const updatedCount = await shippings.rates.updateByZone('north-america', {
  handling_fee: 2.50,
})
```

### Update Rates by Method

```ts
const updatedCount = await shippings.rates.updateByMethod('express', {
  rate_multiplier: 1.1, // 10% increase
})
```

### Delete Shipping Rates

Single shipping rate deletion:
```ts
await shippings.rates.destroy(1) // Replace 1 with the shipping rate ID to delete
```

Bulk deletion:
```ts
await shippings.rates.bulkDestroy([1, 2, 3]) // Array of shipping rate IDs to delete
```

Delete by zone:
```ts
await shippings.rates.destroyByZone('north-america')
```

Delete by method:
```ts
await shippings.rates.destroyByMethod('express')
```

## API Endpoints

The Shipping Rates module provides RESTful API endpoints for managing shipping rates. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/shipping-rates              # List all shipping rates
GET    /commerce/shipping-rates/zone/{zone}  # Get rates by zone
GET    /commerce/shipping-rates/method/{method} # Get rates by method
GET    /commerce/shipping-rates/calculate    # Calculate rate by weight and zone
POST   /commerce/shipping-rates              # Create a new shipping rate
POST   /commerce/shipping-rates/bulk         # Create multiple shipping rates
GET    /commerce/shipping-rates/{id}         # Get a specific shipping rate
PATCH  /commerce/shipping-rates/{id}         # Update a shipping rate
PATCH  /commerce/shipping-rates/bulk         # Update multiple shipping rates
PATCH  /commerce/shipping-rates/zone/{zone}  # Update rates by zone
PATCH  /commerce/shipping-rates/method/{method} # Update rates by method
DELETE /commerce/shipping-rates/{id}         # Delete a shipping rate
DELETE /commerce/shipping-rates/bulk         # Delete multiple shipping rates
DELETE /commerce/shipping-rates/zone/{zone}  # Delete rates by zone
DELETE /commerce/shipping-rates/method/{method} # Delete rates by method
```

### Example Usage

```ts
// List all shipping rates
const response = await fetch('/commerce/shipping-rates')
const shippingRates = await response.json()

// Create a new shipping rate
const response = await fetch('/commerce/shipping-rates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    method: 'express',
    zone: 'north-america',
    weight_from: 0,
    weight_to: 5,
    rate: 15.99,
  }),
})
const newShippingRate = await response.json()

// Calculate shipping rate
const response = await fetch('/commerce/shipping-rates/calculate', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    weight: 5.5,
    zone: 'north-america',
  }),
})
const calculatedRate = await response.json()
```

### Response Format

A successful response includes the shipping rate data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "method": "express",
  "zone": "north-america",
  "weight_from": 0,
  "weight_to": 5,
  "rate": 15.99,
  "handling_fee": 2.00,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Shipping Rates module includes built-in error handling for common scenarios:

- Invalid shipping rate IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Weight range validations ensure proper rate calculations
- Zone and method existence are validated before operations
- Rate calculations are validated for proper numeric values

Example error handling in your code:

```ts
try {
  const shippingRate = await shippings.rates.store({
    method: 'express',
    zone: 'north-america',
    weight_from: 0,
    weight_to: 5,
    rate: 15.99,
  })
} catch (error) {
  console.error('Failed to create shipping rate:', error.message)
}
```

This documentation covers the basic operations available in the Shipping Rates module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
