---
title: Delivery Couriers
description: "The Couriers module in the Commerce package provides a comprehensive set of functions to manage delivery couriers. This module helps you manage courier inform..."
---
# Couriers

The Couriers module in the Commerce package provides a comprehensive set of functions to manage delivery couriers. This module helps you manage courier information, track their status, and handle their contact details.

## Getting Started

First, import the couriers functionality from the Commerce package:

```ts
import { shippings } from '@stacksjs/commerce'
```

## Fetching Couriers

The Commerce package provides several methods to fetch couriers:

### Fetch All Couriers

```ts
const allCouriers = await shippings.couriers.fetchAll()
```

### Fetch a Single Courier

```ts
const courier = await shippings.couriers.fetchById(1) // Replace 1 with the actual courier ID
```

## Managing Couriers

### Store a New Courier

```ts
const newCourier = await shippings.couriers.store({
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  license_number: 'DL123456',
  vehicle_type: 'van',
  status: 'active',
  availability: JSON.stringify({
    monday: ['09:00-17:00'],
    tuesday: ['09:00-17:00'],
    wednesday: ['09:00-17:00'],
    thursday: ['09:00-17:00'],
    friday: ['09:00-17:00'],
  }),
  // ... other courier attributes
})
```

### Store Multiple Couriers

```ts
const newCouriers = await shippings.couriers.bulkStore([
  {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    license_number: 'DL123456',
    status: 'active',
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+1234567891',
    license_number: 'DL123457',
    status: 'active',
  },
])
```

### Update a Courier

```ts
const updatedCourier = await shippings.couriers.update(1, {
  phone: '+1234567892',
  status: 'active',
  vehicle_type: 'truck',
})
```

### Update Courier Status

```ts
const updatedStatus = await shippings.couriers.updateStatus(1, 'on_delivery')
```

### Update Courier Contact Information

```ts
const updatedContact = await shippings.couriers.updateContact(1, '+1234567893')
```

### Delete Couriers

Single courier deletion:

```ts
const deletedCourier = await shippings.couriers.destroy(1) // Returns the deleted courier record
```

Bulk deletion:

```ts
const deletedCount = await shippings.couriers.bulkDestroy([1, 2, 3]) // Returns number of couriers deleted
```

## API Endpoints

The Couriers module provides RESTful API endpoints for managing couriers. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/couriers              # List all couriers
POST   /commerce/couriers              # Create a new courier
POST   /commerce/couriers/bulk         # Create multiple couriers
GET    /commerce/couriers/{id}         # Get a specific courier
PATCH  /commerce/couriers/{id}         # Update a courier
PATCH  /commerce/couriers/{id}/status  # Update courier status
PATCH  /commerce/couriers/{id}/contact # Update courier contact information
DELETE /commerce/couriers/{id}         # Delete a courier
DELETE /commerce/couriers/bulk         # Delete multiple couriers
```

### Example Usage

```ts
// List all couriers
const response = await fetch('/commerce/couriers')
const couriers = await response.json()

// Create a new courier
const response = await fetch('/commerce/couriers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    license_number: 'DL123456',
    vehicle_type: 'van',
    status: 'active',
  }),
})
const newCourier = await response.json()

// Update courier status
const response = await fetch('/commerce/couriers/1/status', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'on_delivery',
  }),
})
const updatedStatus = await response.json()
```

### Response Format

A successful response includes the courier data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "license_number": "DL123456",
  "vehicle_type": "van",
  "status": "active",
  "availability": {
    "monday": ["09:00-17:00"],
    "tuesday": ["09:00-17:00"],
    "wednesday": ["09:00-17:00"],
    "thursday": ["09:00-17:00"],
    "friday": ["09:00-17:00"]
  },
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Couriers module includes built-in error handling for common scenarios:

- Invalid courier IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Contact information validations ensure proper formatting
- Status updates are validated against allowed values ('active', 'on_delivery', 'on_break')
- License number validations ensure proper format
- Email validations ensure proper format

Example error handling in your code:

```ts
try {
  const courier = await shippings.couriers.store({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    license_number: 'DL123456',
    status: 'active',
  })
} catch (error) {
  console.error('Failed to create courier:', error.message)
}
```

This documentation covers the basic operations available in the Couriers module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
