# Shipping Zones

The Shipping Zones module in the Commerce package provides a comprehensive set of functions to manage and interact with your shipping zones. Shipping zones allow you to define geographic areas where specific shipping methods and rates apply.

## Getting Started

First, import the shipping zones functionality from the Commerce package:

```ts
import { shippings } from '@stacksjs/commerce'
```

## Fetching Shipping Zones

The Commerce package provides several methods to fetch shipping zones:

### Fetch All Shipping Zones

```ts
const allShippingZones = await shippings.zones.fetchAll()
```

### Fetch a Single Shipping Zone

```ts
const shippingZone = await shippings.zones.fetchById(1) // Replace 1 with the actual shipping zone ID
```

### Get Active Shipping Zones

```ts
const activeZones = await shippings.zones.getActiveShippingZones()
```

### Get Zones by Country

```ts
const countryZones = await shippings.zones.getZonesByCountry('US') // Replace with country code
```

### Format Zone Options

```ts
const zoneOptions = await shippings.zones.formatZoneOptions()
// Returns array of formatted options with id, name, status, and countries
```

## Managing Shipping Zones

### Store a New Shipping Zone

```ts
const newShippingZone = await shippings.zones.store({
  name: 'North America',
  countries: JSON.stringify(['US', 'CA', 'MX']),
  regions: JSON.stringify(['West Coast', 'East Coast']),
  postal_codes: JSON.stringify(['90210', '10001']),
  status: 'active',
  // ... other shipping zone attributes
})
```

### Store Multiple Shipping Zones

```ts
const newShippingZones = await shippings.zones.bulkStore([
  {
    name: 'Europe',
    countries: JSON.stringify(['GB', 'FR', 'DE']),
    status: 'active',
  },
  {
    name: 'Asia Pacific',
    countries: JSON.stringify(['JP', 'AU', 'SG']),
    status: 'active',
  },
])
```

### Update a Shipping Zone

```ts
const updatedShippingZone = await shippings.zones.update(1, {
  name: 'Updated Zone Name',
  status: 'active',
})
```

### Update Zone Status

```ts
const updatedZone = await shippings.zones.updateStatus(1, 'active')
```

### Update Zone Countries

```ts
const updatedZone = await shippings.zones.updateCountries(1, JSON.stringify(['US', 'CA']))
```

### Update Regions and Postal Codes

```ts
const updatedZone = await shippings.zones.updateRegionsAndPostalCodes(
  1,
  JSON.stringify(['West Coast', 'Midwest']), // regions
  JSON.stringify(['90210', '60601']) // postal codes
)
```

### Delete Shipping Zones

Single shipping zone deletion:
```ts
await shippings.zones.destroy(1) // Replace 1 with the shipping zone ID to delete
```

Bulk deletion:
```ts
await shippings.zones.bulkDestroy([1, 2, 3]) // Array of shipping zone IDs to delete
```

### Soft Delete

Single soft delete:
```ts
await shippings.zones.softDelete(1) // Marks the shipping zone as inactive
```

Bulk soft delete:
```ts
await shippings.zones.bulkSoftDelete([1, 2, 3]) // Marks multiple shipping zones as inactive
```

## API Endpoints

The Shipping Zones module provides RESTful API endpoints for managing shipping zones. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/shipping-zones              # List all shipping zones
POST   /commerce/shipping-zones              # Create a new shipping zone
POST   /commerce/shipping-zones/bulk         # Create multiple shipping zones
GET    /commerce/shipping-zones/{id}         # Get a specific shipping zone
GET    /commerce/shipping-zones/country/{code} # Get zones by country code
PATCH  /commerce/shipping-zones/{id}         # Update a shipping zone
PATCH  /commerce/shipping-zones/{id}/status  # Update shipping zone status
PATCH  /commerce/shipping-zones/{id}/countries # Update shipping zone countries
PATCH  /commerce/shipping-zones/{id}/regions # Update shipping zone regions and postal codes
DELETE /commerce/shipping-zones/{id}         # Delete a shipping zone
DELETE /commerce/shipping-zones/bulk         # Delete multiple shipping zones
```

### Example Usage

```ts
// List all shipping zones
const response = await fetch('/commerce/shipping-zones')
const shippingZones = await response.json()

// Create a new shipping zone
const response = await fetch('/commerce/shipping-zones', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'North America',
    countries: JSON.stringify(['US', 'CA', 'MX']),
    status: 'active',
  }),
})
const newShippingZone = await response.json()

// Update shipping zone regions
const response = await fetch('/commerce/shipping-zones/1/regions', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    regions: ['West Coast', 'East Coast'],
    postal_codes: ['90210', '10001'],
  }),
})
const updatedZone = await response.json()
```

### Response Format

A successful response includes the shipping zone data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "North America",
  "countries": ["US", "CA", "MX"],
  "regions": ["West Coast", "East Coast"],
  "postal_codes": ["90210", "10001"],
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Shipping Zones module includes built-in error handling for common scenarios:

- Invalid shipping zone IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Status updates are validated against allowed values
- Country codes are validated for correct format
- JSON parsing errors for countries, regions, and postal codes are handled

Example error handling in your code:

```ts
try {
  const shippingZone = await shippings.zones.store({
    name: 'North America',
    countries: JSON.stringify(['US', 'CA']),
  })
} catch (error) {
  console.error('Failed to create shipping zone:', error.message)
}
```

This documentation covers the basic operations available in the Shipping Zones module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
