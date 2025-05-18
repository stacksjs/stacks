# License Keys

The License Keys module in the Commerce package provides a comprehensive set of functions to manage and interact with your software license keys. This module handles the generation, distribution, and management of license keys for your digital products.

## Getting Started

First, import the license keys functionality from the Commerce package:

```ts
import { shippings } from '@stacksjs/commerce'
```

## Fetching License Keys

The Commerce package provides several methods to fetch license keys:

### Fetch All License Keys

```ts
const allLicenseKeys = await shippings.licenses.fetchAll()
```

### Fetch a Single License Key

```ts
const licenseKey = await shippings.licenses.fetchById(1) // Replace 1 with the actual license key ID
```

## Managing License Keys

### Store a New License Key

```ts
const newLicenseKey = await shippings.licenses.store({
  product_id: 1,
  key: 'XXXX-YYYY-ZZZZ-WWWW',
  activation_limit: 3,
  expiry_date: '2025-12-31',
  status: 'active',
  type: 'perpetual', // or 'subscription'
  features: JSON.stringify(['feature1', 'feature2']),
  // ... other license key attributes
})
```

### Store Multiple License Keys

```ts
const newLicenseKeys = await shippings.licenses.bulkStore([
  {
    product_id: 1,
    key: 'AAAA-BBBB-CCCC-DDDD',
    activation_limit: 1,
    type: 'perpetual',
  },
  {
    product_id: 2,
    key: 'EEEE-FFFF-GGGG-HHHH',
    activation_limit: 5,
    expiry_date: '2025-12-31',
    type: 'subscription',
  },
])
```

### Update a License Key

```ts
const updatedLicenseKey = await shippings.licenses.update(1, {
  activation_limit: 5,
  status: 'active',
  features: JSON.stringify(['feature1', 'feature2', 'feature3']),
})
```

### Update License Key Status

```ts
const updatedStatus = await shippings.licenses.updateStatus(1, 'active')
```

### Update License Key Expiration

```ts
const updatedExpiration = await shippings.licenses.updateExpiration(1, '2026-12-31')
```

### Delete License Keys

Single license key deletion:
```ts
await shippings.licenses.destroy(1) // Replace 1 with the license key ID to delete
```

Bulk deletion:
```ts
await shippings.licenses.bulkDestroy([1, 2, 3]) // Array of license key IDs to delete
```

### Soft Delete

Single soft delete:
```ts
await shippings.licenses.softDelete(1) // Marks the license key as inactive
```

Bulk soft delete:
```ts
await shippings.licenses.bulkSoftDelete([1, 2, 3]) // Marks multiple license keys as inactive
```

## API Endpoints

The License Keys module provides RESTful API endpoints for managing license keys. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/license-keys              # List all license keys
POST   /commerce/license-keys              # Create a new license key
POST   /commerce/license-keys/bulk         # Create multiple license keys
GET    /commerce/license-keys/{id}         # Get a specific license key
PATCH  /commerce/license-keys/{id}         # Update a license key
PATCH  /commerce/license-keys/{id}/status  # Update license key status
PATCH  /commerce/license-keys/{id}/expiration # Update license key expiration
DELETE /commerce/license-keys/{id}         # Delete a license key
DELETE /commerce/license-keys/bulk         # Delete multiple license keys
```

### Example Usage

```ts
// List all license keys
const response = await fetch('/commerce/license-keys')
const licenseKeys = await response.json()

// Create a new license key
const response = await fetch('/commerce/license-keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    product_id: 1,
    key: 'XXXX-YYYY-ZZZZ-WWWW',
    activation_limit: 3,
    expiry_date: '2025-12-31',
    type: 'perpetual',
    features: JSON.stringify(['feature1', 'feature2']),
  }),
})
const newLicenseKey = await response.json()

// Update license key expiration
const response = await fetch('/commerce/license-keys/1/expiration', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    expiry_date: '2026-12-31',
  }),
})
const updatedExpiration = await response.json()
```

### Response Format

A successful response includes the license key data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "product_id": 1,
  "key": "XXXX-YYYY-ZZZZ-WWWW",
  "activation_limit": 3,
  "activation_count": 0,
  "expiry_date": "2025-12-31T00:00:00.000Z",
  "type": "perpetual",
  "features": ["feature1", "feature2"],
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The License Keys module includes built-in error handling for common scenarios:

- Invalid license key IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- License key format validations ensure proper key structure
- Activation limit validations prevent overuse
- Expiration date validations ensure proper date formatting
- Status updates are validated against allowed values

Example error handling in your code:

```ts
try {
  const licenseKey = await shippings.licenses.store({
    product_id: 1,
    key: 'XXXX-YYYY-ZZZZ-WWWW',
    activation_limit: 3,
    type: 'perpetual',
  })
} catch (error) {
  console.error('Failed to create license key:', error.message)
}
```

This documentation covers the basic operations available in the License Keys module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
