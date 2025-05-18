# Delivery Routes

The Delivery Routes module in the Commerce package provides a comprehensive set of functions to manage and track delivery routes. This module helps you manage delivery drivers, track active routes, and monitor delivery metrics.

## Getting Started

First, import the delivery routes functionality from the Commerce package:

```ts
import { shippings } from '@stacksjs/commerce'
```

## Fetching Delivery Routes

The Commerce package provides several methods to fetch delivery routes:

### Fetch All Routes

```ts
const allRoutes = await shippings.routes.fetchAll()
```

### Fetch a Single Route

```ts
const route = await shippings.routes.fetchById(1) // Replace 1 with the actual route ID
```

### Fetch Active Routes

```ts
const activeRoutes = await shippings.routes.fetchActive() // Returns routes active in the last 24 hours
```

### Fetch Routes by Driver

```ts
const driverRoutes = await shippings.routes.fetchByDriver('driver-id')
```

## Managing Delivery Routes

### Store a New Route

```ts
const newRoute = await shippings.routes.store({
  driver: 'driver-id',
  vehicle: 'vehicle-id',
  stops: 5,
  delivery_time: 120, // in minutes
  total_distance: 50.5, // in kilometers/miles
  start_location: JSON.stringify({
    lat: 37.7749,
    lng: -122.4194,
  }),
  end_location: JSON.stringify({
    lat: 37.3382,
    lng: -121.8863,
  }),
  // ... other route attributes
})
```

### Update a Route

```ts
const updatedRoute = await shippings.routes.update(1, {
  stops: 6,
  delivery_time: 130,
  total_distance: 55.2,
})
```

### Update Route Stops

```ts
const updatedStops = await shippings.routes.updateStops(1, 7)
```

### Update Route Metrics

```ts
const updatedMetrics = await shippings.routes.updateMetrics(
  1,
  140, // delivery_time in minutes
  60.5  // total_distance in kilometers/miles
)
```

### Update Last Active Timestamp

```ts
const updatedActivity = await shippings.routes.updateLastActive(1)
```

### Delete Routes

Single route deletion:
```ts
await shippings.routes.destroy(1) // Replace 1 with the route ID to delete
```

Bulk deletion:
```ts
await shippings.routes.bulkDestroy([1, 2, 3]) // Array of route IDs to delete
```

## API Endpoints

The Delivery Routes module provides RESTful API endpoints for managing delivery routes. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/delivery-routes              # List all delivery routes
GET    /commerce/delivery-routes/active       # List active delivery routes
GET    /commerce/delivery-routes/driver/{id}  # Get routes by driver
POST   /commerce/delivery-routes              # Create a new delivery route
GET    /commerce/delivery-routes/{id}         # Get a specific delivery route
PATCH  /commerce/delivery-routes/{id}         # Update a delivery route
PATCH  /commerce/delivery-routes/{id}/stops   # Update route stops
PATCH  /commerce/delivery-routes/{id}/metrics # Update route metrics
PATCH  /commerce/delivery-routes/{id}/active  # Update last active timestamp
DELETE /commerce/delivery-routes/{id}         # Delete a delivery route
DELETE /commerce/delivery-routes/bulk         # Delete multiple delivery routes
```

### Example Usage

```ts
// List all delivery routes
const response = await fetch('/commerce/delivery-routes')
const deliveryRoutes = await response.json()

// Create a new delivery route
const response = await fetch('/commerce/delivery-routes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    driver: 'driver-id',
    vehicle: 'vehicle-id',
    stops: 5,
    delivery_time: 120,
    total_distance: 50.5,
    start_location: JSON.stringify({
      lat: 37.7749,
      lng: -122.4194,
    }),
    end_location: JSON.stringify({
      lat: 37.3382,
      lng: -121.8863,
    }),
  }),
})
const newDeliveryRoute = await response.json()

// Update route metrics
const response = await fetch('/commerce/delivery-routes/1/metrics', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    delivery_time: 140,
    total_distance: 60.5,
  }),
})
const updatedMetrics = await response.json()
```

### Response Format

A successful response includes the delivery route data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "driver": "driver-id",
  "vehicle": "vehicle-id",
  "stops": 5,
  "delivery_time": 120,
  "total_distance": 50.5,
  "start_location": {
    "lat": 37.7749,
    "lng": -122.4194
  },
  "end_location": {
    "lat": 37.3382,
    "lng": -121.8863
  },
  "last_active": "2024-01-01T12:00:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Delivery Routes module includes built-in error handling for common scenarios:

- Invalid delivery route IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Location coordinate validations ensure proper formatting
- Metric validations ensure proper numeric values
- Activity timestamp validations ensure proper date formatting

Example error handling in your code:

```ts
try {
  const deliveryRoute = await shippings.routes.store({
    driver: 'driver-id',
    vehicle: 'vehicle-id',
    stops: 5,
    delivery_time: 120,
    total_distance: 50.5,
  })
} catch (error) {
  console.error('Failed to create delivery route:', error.message)
}
```

This documentation covers the basic operations available in the Delivery Routes module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
