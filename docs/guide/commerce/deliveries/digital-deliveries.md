# Digital Delivery

The Digital Delivery module in the Commerce package provides a comprehensive set of functions to manage and interact with your digital product deliveries. This module handles the delivery of digital products such as downloads, software licenses, digital content, and other non-physical items.

## Getting Started

First, import the digital delivery functionality from the Commerce package:

```ts
import { shippings } from '@stacksjs/commerce'
```

## Fetching Digital Deliveries

The Commerce package provides several methods to fetch digital deliveries:

### Fetch All Digital Deliveries

```ts
const allDeliveries = await shippings.digital.fetchAll()
```

### Fetch a Single Digital Delivery

```ts
const delivery = await shippings.digital.fetchById(1) // Replace 1 with the actual delivery ID
```

## Managing Digital Deliveries

### Store a New Digital Delivery

```ts
const newDelivery = await shippings.digital.store({
  product_id: 1,
  file_path: '/path/to/digital/content.pdf',
  download_limit: 3,
  expiry_days: 30,
  requires_login: true,
  automatic_delivery: true,
  status: 'active',
  // ... other digital delivery attributes
})
```

### Store Multiple Digital Deliveries

```ts
const newDeliveries = await shippings.digital.bulkStore([
  {
    product_id: 1,
    file_path: '/path/to/ebook.pdf',
    download_limit: 3,
    expiry_days: 30,
    requires_login: true,
  },
  {
    product_id: 2,
    file_path: '/path/to/software.zip',
    download_limit: 1,
    expiry_days: 7,
    requires_login: true,
  },
])
```

### Update a Digital Delivery

```ts
const updatedDelivery = await shippings.digital.update(1, {
  download_limit: 5,
  expiry_days: 60,
  status: 'active',
})
```

### Update Delivery Settings

```ts
const updatedSettings = await shippings.digital.updateDeliverySettings(
  1,
  5, // download_limit
  60, // expiry_days
  true, // requires_login
  true // automatic_delivery
)
```

### Update Delivery Status

```ts
const updatedStatus = await shippings.digital.updateStatus(1, 'active')
```

### Delete Digital Deliveries

Single digital delivery deletion:
```ts
await shippings.digital.destroy(1) // Replace 1 with the delivery ID to delete
```

Bulk deletion:
```ts
await shippings.digital.bulkDestroy([1, 2, 3]) // Array of delivery IDs to delete
```

### Soft Delete

Single soft delete:
```ts
await shippings.digital.softDelete(1) // Marks the delivery as inactive
```

Bulk soft delete:
```ts
await shippings.digital.bulkSoftDelete([1, 2, 3]) // Marks multiple deliveries as inactive
```

## API Endpoints

The Digital Delivery module provides RESTful API endpoints for managing digital deliveries. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/digital-deliveries              # List all digital deliveries
POST   /commerce/digital-deliveries              # Create a new digital delivery
POST   /commerce/digital-deliveries/bulk         # Create multiple digital deliveries
GET    /commerce/digital-deliveries/{id}         # Get a specific digital delivery
PATCH  /commerce/digital-deliveries/{id}         # Update a digital delivery
PATCH  /commerce/digital-deliveries/{id}/status  # Update delivery status
PATCH  /commerce/digital-deliveries/{id}/settings # Update delivery settings
DELETE /commerce/digital-deliveries/{id}         # Delete a digital delivery
DELETE /commerce/digital-deliveries/bulk         # Delete multiple digital deliveries
```

### Example Usage

```ts
// List all digital deliveries
const response = await fetch('/commerce/digital-deliveries')
const digitalDeliveries = await response.json()

// Create a new digital delivery
const response = await fetch('/commerce/digital-deliveries', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    product_id: 1,
    file_path: '/path/to/digital/content.pdf',
    download_limit: 3,
    expiry_days: 30,
    requires_login: true,
    automatic_delivery: true,
  }),
})
const newDigitalDelivery = await response.json()

// Update delivery settings
const response = await fetch('/commerce/digital-deliveries/1/settings', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    download_limit: 5,
    expiry_days: 60,
    requires_login: true,
    automatic_delivery: true,
  }),
})
const updatedSettings = await response.json()
```

### Response Format

A successful response includes the digital delivery data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "product_id": 1,
  "file_path": "/path/to/digital/content.pdf",
  "download_limit": 3,
  "expiry_days": 30,
  "requires_login": true,
  "automatic_delivery": true,
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Digital Delivery module includes built-in error handling for common scenarios:

- Invalid digital delivery IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- File path validations ensure proper content accessibility
- Download limit and expiry validations ensure proper delivery constraints
- Status updates are validated against allowed values

Example error handling in your code:

```ts
try {
  const digitalDelivery = await shippings.digital.store({
    product_id: 1,
    file_path: '/path/to/digital/content.pdf',
    download_limit: 3,
    expiry_days: 30,
  })
} catch (error) {
  console.error('Failed to create digital delivery:', error.message)
}
```

This documentation covers the basic operations available in the Digital Delivery module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
