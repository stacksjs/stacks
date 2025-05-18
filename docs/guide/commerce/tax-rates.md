# Tax Rates

The Tax Rates module in the Commerce package provides a comprehensive set of functions to manage tax rates for your e-commerce system. This module helps you handle tax calculations, regional tax rules, and tax rate management.

## Getting Started

First, import the tax rates functionality from the Commerce package:

```ts
import { tax } from '@stacksjs/commerce'
```

## Fetching Tax Rates

The Commerce package provides several methods to fetch tax rates:

### Fetch All Tax Rates

```ts
const allTaxRates = await tax.fetchAll()
```

### Fetch a Single Tax Rate

```ts
const taxRate = await tax.fetchById(1) // Replace 1 with the actual tax rate ID
```

## Managing Tax Rates

### Store a New Tax Rate

```ts
const newTaxRate = await tax.store({
  name: 'Standard VAT',
  rate: 20.0,
  type: 'percentage',
  country: 'US',
  region: 'CA',
  status: 'active',
  is_default: false,
})
```

### Store Multiple Tax Rates

```ts
const newTaxRates = await tax.bulkStore([
  {
    name: 'Standard VAT',
    rate: 20.0,
    type: 'percentage',
    country: 'US',
    region: 'CA',
    status: 'active',
  },
  {
    name: 'Reduced Rate',
    rate: 5.0,
    type: 'percentage',
    country: 'US',
    region: 'NY',
    status: 'active',
  },
])
```

### Update a Tax Rate

```ts
const updatedTaxRate = await tax.update(1, {
  name: 'Updated VAT Rate',
  rate: 21.0,
  status: 'active',
})
```

### Update Tax Rate Status

```ts
const updatedStatus = await tax.updateStatus(1, 'inactive')
```

### Update Rate Value

```ts
const updatedRate = await tax.updateRate(1, 22.5)
```

### Delete Tax Rates

Single tax rate deletion:
```ts
const deleted = await tax.destroy(1) // Returns true if successful
```

Bulk deletion:
```ts
const deletedCount = await tax.bulkDestroy([1, 2, 3]) // Returns number of tax rates deleted
```

## API Endpoints

The Tax Rates module provides RESTful API endpoints for managing tax rates. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/tax-rates              # List all tax rates
POST   /commerce/tax-rates              # Create a new tax rate
POST   /commerce/tax-rates/bulk         # Create multiple tax rates
GET    /commerce/tax-rates/{id}         # Get a specific tax rate
PATCH  /commerce/tax-rates/{id}         # Update a tax rate
PATCH  /commerce/tax-rates/{id}/status  # Update tax rate status
PATCH  /commerce/tax-rates/{id}/rate    # Update rate value
DELETE /commerce/tax-rates/{id}         # Delete a tax rate
DELETE /commerce/tax-rates/bulk         # Delete multiple tax rates
```

### Example Usage

```ts
// List all tax rates
const response = await fetch('/commerce/tax-rates')
const taxRates = await response.json()

// Create a new tax rate
const response = await fetch('/commerce/tax-rates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Standard VAT',
    rate: 20.0,
    type: 'percentage',
    country: 'US',
    region: 'CA',
    status: 'active',
  }),
})
const newTaxRate = await response.json()

// Update tax rate
const response = await fetch('/commerce/tax-rates/1/rate', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    rate: 21.0,
  }),
})
const updatedRate = await response.json()
```

### Response Format

A successful response includes the tax rate data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Standard VAT",
  "rate": 20.0,
  "type": "percentage",
  "country": "US",
  "region": "CA",
  "status": "active",
  "is_default": false,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Tax Rates module includes built-in error handling for common scenarios:

- Invalid tax rate IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Rate value validations ensure proper numeric format
- Status updates are validated against allowed values ('active', 'inactive')
- Country and region codes are validated for proper format

Example error handling in your code:

```ts
try {
  const taxRate = await tax.store({
    name: 'Standard VAT',
    rate: 20.0,
    type: 'percentage',
    country: 'US',
    region: 'CA',
    status: 'active',
  })
} catch (error) {
  console.error('Failed to create tax rate:', error.message)
}
```

This documentation covers the basic operations available in the Tax Rates module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
