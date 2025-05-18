# Product Units

The Product Units module in the Commerce package provides a robust set of functions to manage and interact with your product unit data. This guide will walk you through the various operations you can perform with product units.

## Getting Started

First, import the product units functionality from the Commerce package:

```ts
import { products } from '@stacksjs/commerce'
```

## Fetching Product Units

The Commerce package provides several methods to fetch product units:

### Fetch All Product Units

```ts
const allUnits = await products.units.fetchAll()
```

### Fetch a Single Product Unit

```ts
const unit = await products.units.fetchById(1) // Replace 1 with the actual unit ID
```

### Get Default Unit for a Type

```ts
const defaultUnit = await products.units.getDefaultUnit('weight') // Get default unit for weight type
```

### Format Unit Options

```ts
// Get all unit options
const allOptions = await products.units.formatUnitOptions()

// Get unit options for a specific type
const weightOptions = await products.units.formatUnitOptions('weight')
```

## Managing Product Units

### Store a New Product Unit

```ts
const newUnit = await products.units.store({
  name: 'Kilogram',
  abbreviation: 'kg',
  type: 'weight',
  is_default: true,
  // ... other unit attributes
})
```

### Store Multiple Product Units

```ts
const newUnits = await products.units.bulkStore([
  {
    name: 'Kilogram',
    abbreviation: 'kg',
    type: 'weight',
    is_default: true,
  },
  {
    name: 'Gram',
    abbreviation: 'g',
    type: 'weight',
    is_default: false,
  },
])
```

### Update a Product Unit

```ts
const updatedUnit = await products.units.update(1, {
  name: 'Kilogram',
  abbreviation: 'kg',
  is_default: true,
})
```

### Update Multiple Product Units

```ts
const updatedUnits = await products.units.bulkUpdate([
  {
    id: 1,
    name: 'Kilogram',
    abbreviation: 'kg',
    is_default: true,
  },
  {
    id: 2,
    name: 'Gram',
    abbreviation: 'g',
    is_default: false,
  },
])
```

### Update Default Status

```ts
const success = await products.units.updateDefaultStatus(1, true) // Set as default unit
```

### Delete Product Units

Single unit deletion:
```ts
await products.units.destroy(1) // Replace 1 with the unit ID to delete
```

Bulk deletion:
```ts
await products.units.bulkDestroy([1, 2, 3]) // Array of unit IDs to delete
```

## API Endpoints

The Product Units module provides RESTful API endpoints for managing product units. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/units              # List all product units
POST   /commerce/units              # Create a new product unit
POST   /commerce/units/bulk         # Create multiple product units
GET    /commerce/units/{id}         # Get a specific product unit
GET    /commerce/units/default/{type}  # Get default unit for a type
GET    /commerce/units/options      # Get formatted unit options
GET    /commerce/units/options/{type}  # Get formatted unit options for a type
PATCH  /commerce/units/{id}         # Update a product unit
PATCH  /commerce/units/bulk         # Update multiple product units
PATCH  /commerce/units/{id}/default # Update default status
DELETE /commerce/units/{id}         # Delete a product unit
DELETE /commerce/units/bulk         # Delete multiple product units
```

### Example Usage

```ts
// List all product units
const response = await fetch('/commerce/units')
const units = await response.json()

// Create a new product unit
const response = await fetch('/commerce/units', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Kilogram',
    abbreviation: 'kg',
    type: 'weight',
    is_default: true,
  }),
})
const newUnit = await response.json()

// Get a specific product unit
const response = await fetch('/commerce/units/1')
const unit = await response.json()

// Update a product unit
const response = await fetch('/commerce/units/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Kilogram',
    abbreviation: 'kg',
    is_default: true,
  }),
})
const updatedUnit = await response.json()

// Update default status
const response = await fetch('/commerce/units/1/default', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    is_default: true,
  }),
})
const success = await response.json()

// Delete a product unit
await fetch('/commerce/units/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the product unit data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Kilogram",
  "abbreviation": "kg",
  "type": "weight",
  "is_default": true,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Unit Options Response Format

When fetching formatted unit options:

```json
[
  {
    "id": "1",
    "name": "Kilogram",
    "abbreviation": "kg",
    "is_default": true
  },
  {
    "id": "2",
    "name": "Gram",
    "abbreviation": "g",
    "is_default": false
  }
]
```

## Error Handling

The Product Units module includes built-in error handling for common scenarios:

- Attempting to update or delete a non-existent unit will throw an error
- Missing required fields during creation will throw an error
- Setting a unit as default will automatically update other units of the same type
- All database operations are wrapped in try-catch blocks to provide meaningful error messages
- Bulk operations are wrapped in transactions to ensure data consistency
- Default unit management is handled automatically to maintain data integrity

This documentation covers the basic operations available in the Product Units module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
