# Drivers

The Drivers module in the Commerce package provides a comprehensive set of functions to manage delivery drivers. This module helps you manage driver information, track their status, and handle their contact details.

## Getting Started

First, import the drivers functionality from the Commerce package:

```ts
import { shippings } from '@stacksjs/commerce'
```

## Fetching Drivers

The Commerce package provides several methods to fetch drivers:

### Fetch All Drivers

```ts
const allDrivers = await shippings.drivers.fetchAll()
```

### Fetch a Single Driver

```ts
const driver = await shippings.drivers.fetchById(1) // Replace 1 with the actual driver ID
```

## Managing Drivers

### Store a New Driver

```ts
const newDriver = await shippings.drivers.store({
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
  // ... other driver attributes
})
```

### Store Multiple Drivers

```ts
const newDrivers = await shippings.drivers.bulkStore([
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

### Update a Driver

```ts
const updatedDriver = await shippings.drivers.update(1, {
  phone: '+1234567892',
  status: 'active',
  vehicle_type: 'truck',
})
```

### Update Driver Status

```ts
const updatedStatus = await shippings.drivers.updateStatus(1, 'on_delivery')
```

### Update Driver Contact Information

```ts
const updatedContact = await shippings.drivers.updateContact(1, '+1234567893')
```

### Delete Drivers

Single driver deletion:
```ts
const deletedDriver = await shippings.drivers.destroy(1) // Returns the deleted driver record
```

Bulk deletion:
```ts
const deletedCount = await shippings.drivers.bulkDestroy([1, 2, 3]) // Returns number of drivers deleted
```

## API Endpoints

The Drivers module provides RESTful API endpoints for managing drivers. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/drivers              # List all drivers
POST   /commerce/drivers              # Create a new driver
POST   /commerce/drivers/bulk         # Create multiple drivers
GET    /commerce/drivers/{id}         # Get a specific driver
PATCH  /commerce/drivers/{id}         # Update a driver
PATCH  /commerce/drivers/{id}/status  # Update driver status
PATCH  /commerce/drivers/{id}/contact # Update driver contact information
DELETE /commerce/drivers/{id}         # Delete a driver
DELETE /commerce/drivers/bulk         # Delete multiple drivers
```

### Example Usage

```ts
// List all drivers
const response = await fetch('/commerce/drivers')
const drivers = await response.json()

// Create a new driver
const response = await fetch('/commerce/drivers', {
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
const newDriver = await response.json()

// Update driver status
const response = await fetch('/commerce/drivers/1/status', {
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

A successful response includes the driver data with all its attributes:

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

The Drivers module includes built-in error handling for common scenarios:

- Invalid driver IDs will throw appropriate errors
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
  const driver = await shippings.drivers.store({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    license_number: 'DL123456',
    status: 'active',
  })
} catch (error) {
  console.error('Failed to create driver:', error.message)
}
```

This documentation covers the basic operations available in the Drivers module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
