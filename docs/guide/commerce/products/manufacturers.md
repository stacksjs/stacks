# Manufacturers

The Manufacturers module in the Commerce package provides a robust set of functions to manage and interact with your product manufacturer data. This guide will walk you through the various operations you can perform with manufacturers.

## Getting Started

First, import the manufacturers functionality from the Commerce package:

```ts
import { products } from '@stacksjs/commerce'
```

## Fetching Manufacturers

The Commerce package provides several methods to fetch manufacturers:

### Fetch All Manufacturers

```ts
const allManufacturers = await products.manufacturers.fetchAll()
```

### Fetch a Single Manufacturer

```ts
const manufacturer = await products.manufacturers.fetchById(1) // Replace 1 with the actual manufacturer ID
```

### Fetch by UUID

```ts
const manufacturer = await products.manufacturers.fetchByUuid('550e8400-e29b-41d4-a716-446655440000')
```

### Fetch Featured Manufacturers

```ts
const featuredManufacturers = await products.manufacturers.fetchFeatured(10) // Get 10 featured manufacturers
```

### Fetch Manufacturers by Country

```ts
const manufacturers = await products.manufacturers.fetchByCountry('USA', {
  page: 1,
  limit: 10,
})
```

### Fetch Manufacturers with Product Count

```ts
const manufacturers = await products.manufacturers.fetchWithProductCount({
  country: 'USA',
  featured: true,
})
```

## Managing Manufacturers

### Store a New Manufacturer

```ts
const newManufacturer = await products.manufacturers.store({
  manufacturer: 'Example Corp',
  description: 'Leading manufacturer of quality products',
  country: 'USA',
  featured: false,
  // ... other manufacturer attributes
})
```

### Store Multiple Manufacturers

```ts
const newManufacturers = await products.manufacturers.bulkStore([
  {
    manufacturer: 'Example Corp',
    description: 'Leading manufacturer of quality products',
    country: 'USA',
    featured: false,
  },
  {
    manufacturer: 'Sample Inc',
    description: 'Innovative product solutions',
    country: 'Canada',
    featured: true,
  },
])
```

### Update a Manufacturer

```ts
const updatedManufacturer = await products.manufacturers.update(1, {
  description: 'Updated description',
  featured: true,
})
```

### Update by UUID

```ts
const updatedManufacturer = await products.manufacturers.updateByUuid('550e8400-e29b-41d4-a716-446655440000', {
  description: 'Updated description',
  featured: true,
})
```

### Update Featured Status

```ts
const updatedManufacturer = await products.manufacturers.updateFeaturedStatus(1, true) // Set as featured
```

### Delete Manufacturers

Single manufacturer deletion:
```ts
await products.manufacturers.destroy(1) // Replace 1 with the manufacturer ID to delete
```

Bulk deletion:
```ts
await products.manufacturers.bulkDestroy([1, 2, 3]) // Array of manufacturer IDs to delete
```

## API Endpoints

The Manufacturers module provides RESTful API endpoints for managing manufacturers. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/manufacturers              # List all manufacturers
POST   /commerce/manufacturers              # Create a new manufacturer
POST   /commerce/manufacturers/bulk         # Create multiple manufacturers
GET    /commerce/manufacturers/{id}         # Get a specific manufacturer
GET    /commerce/manufacturers/uuid/{uuid}  # Get a manufacturer by UUID
GET    /commerce/manufacturers/featured     # Get featured manufacturers
GET    /commerce/manufacturers/country/{country}  # Get manufacturers by country
GET    /commerce/manufacturers/products     # Get manufacturers with product count
PATCH  /commerce/manufacturers/{id}         # Update a manufacturer
PATCH  /commerce/manufacturers/uuid/{uuid}  # Update a manufacturer by UUID
PATCH  /commerce/manufacturers/{id}/featured  # Update featured status
DELETE /commerce/manufacturers/{id}         # Delete a manufacturer
DELETE /commerce/manufacturers/bulk         # Delete multiple manufacturers
```

### Example Usage

```ts
// List all manufacturers
const response = await fetch('/commerce/manufacturers')
const manufacturers = await response.json()

// Create a new manufacturer
const response = await fetch('/commerce/manufacturers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    manufacturer: 'Example Corp',
    description: 'Leading manufacturer of quality products',
    country: 'USA',
    featured: false,
  }),
})
const newManufacturer = await response.json()

// Get a specific manufacturer
const response = await fetch('/commerce/manufacturers/1')
const manufacturer = await response.json()

// Update a manufacturer
const response = await fetch('/commerce/manufacturers/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    description: 'Updated description',
    featured: true,
  }),
})
const updatedManufacturer = await response.json()

// Delete a manufacturer
await fetch('/commerce/manufacturers/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the manufacturer data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "manufacturer": "Example Corp",
  "description": "Leading manufacturer of quality products",
  "country": "USA",
  "featured": false,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Country Response Format

When fetching manufacturers by country, the response includes pagination information:

```json
{
  "data": [
    {
      "id": 1,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "manufacturer": "Example Corp",
      "description": "Leading manufacturer of quality products",
      "country": "USA",
      "featured": false,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "paging": {
    "total_records": 100,
    "page": 1,
    "total_pages": 10
  },
  "next_cursor": 2
}
```

### Product Count Response Format

When fetching manufacturers with product count:

```json
[
  {
    "id": 1,
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "manufacturer": "Example Corp",
    "description": "Leading manufacturer of quality products",
    "country": "USA",
    "featured": false,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z",
    "product_count": 25
  }
]
```

## Error Handling

The Manufacturers module includes built-in error handling for common scenarios:

- Duplicate manufacturer names will throw an error with the message "A manufacturer with this name already exists"
- Attempting to update or delete a non-existent manufacturer will throw an error
- Missing required fields during creation will throw an error
- All database operations are wrapped in try-catch blocks to provide meaningful error messages
- Bulk operations are wrapped in transactions to ensure data consistency

This documentation covers the basic operations available in the Manufacturers module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
