# Product Variants

The Product Variants module in the Commerce package provides a robust set of functions to manage and interact with your product variant data. This guide will walk you through the various operations you can perform with product variants.

## Getting Started

First, import the product variants functionality from the Commerce package:

```ts
import { products } from '@stacksjs/commerce'
```

## Fetching Variants

The Commerce package provides several methods to fetch variants:

### Fetch All Variants

```ts
const allVariants = await products.variants.fetchAll()
```

### Fetch a Single Variant

```ts
const variant = await products.variants.fetchById(1) // Replace 1 with the actual variant ID
```

## Managing Variants

### Store a New Variant

```ts
const newVariant = await products.variants.store({
  product_id: 1,
  sku: 'TSHIRT-S-RED',
  title: 'T-Shirt - Small - Red',
  price: 29.99,
  compare_at_price: 39.99,
  inventory_quantity: 100,
  inventory_policy: 'deny',
  inventory_management: 'shopify',
  options: ['Small', 'Red'],
  status: 'active',
  // ... other variant attributes
})
```

### Store Multiple Variants

```ts
const newVariants = await products.variants.bulkStore([
  {
    product_id: 1,
    sku: 'TSHIRT-S-RED',
    title: 'T-Shirt - Small - Red',
    price: 29.99,
    options: ['Small', 'Red'],
  },
  {
    product_id: 1,
    sku: 'TSHIRT-M-BLUE',
    title: 'T-Shirt - Medium - Blue',
    price: 29.99,
    options: ['Medium', 'Blue'],
  },
])
```

### Update a Variant

```ts
const updatedVariant = await products.variants.update(1, {
  price: 34.99,
  inventory_quantity: 50,
  status: 'active',
})
```

### Update Multiple Variants

```ts
const updatedVariants = await products.variants.bulkUpdate([
  {
    id: 1,
    price: 34.99,
    inventory_quantity: 50,
  },
  {
    id: 2,
    price: 34.99,
    inventory_quantity: 75,
  },
])
```

### Update Variant Status

```ts
const success = await products.variants.updateStatus(1, 'active') // Set status to active
```

### Delete Variants

Single variant deletion:
```ts
await products.variants.destroy(1) // Replace 1 with the variant ID to delete
```

Bulk deletion:
```ts
await products.variants.bulkDestroy([1, 2, 3]) // Array of variant IDs to delete
```

## Variant Options Management

### Format Variant Options

```ts
// Format raw options into a JSON string
const formattedOptions = variants.formatVariantOptions(['Small', 'Red', 'Cotton'])
```

### Generate Variant Combinations

```ts
// Generate all possible combinations of variant options
const combinations = variants.generateVariantCombinations({
  size: ['S', 'M', 'L'],
  color: ['Red', 'Blue'],
  material: ['Cotton', 'Polyester'],
})

// This will generate combinations like:
// [
//   { size: 'S', color: 'Red', material: 'Cotton' },
//   { size: 'S', color: 'Red', material: 'Polyester' },
//   { size: 'S', color: 'Blue', material: 'Cotton' },
//   ...
// ]
```

## API Endpoints

The Product Variants module provides RESTful API endpoints for managing variants. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/variants              # List all variants
POST   /commerce/variants              # Create a new variant
POST   /commerce/variants/bulk         # Create multiple variants
GET    /commerce/variants/{id}         # Get a specific variant
PATCH  /commerce/variants/{id}         # Update a variant
PATCH  /commerce/variants/bulk         # Update multiple variants
PATCH  /commerce/variants/{id}/status  # Update variant status
DELETE /commerce/variants/{id}         # Delete a variant
DELETE /commerce/variants/bulk         # Delete multiple variants
```

### Example Usage

```ts
// List all variants
const response = await fetch('/commerce/variants')
const variants = await response.json()

// Create a new variant
const response = await fetch('/commerce/variants', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    product_id: 1,
    sku: 'TSHIRT-S-RED',
    title: 'T-Shirt - Small - Red',
    price: 29.99,
    options: ['Small', 'Red'],
  }),
})
const newVariant = await response.json()

// Get a specific variant
const response = await fetch('/commerce/variants/1')
const variant = await response.json()

// Update a variant
const response = await fetch('/commerce/variants/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    price: 34.99,
    inventory_quantity: 50,
  }),
})
const updatedVariant = await response.json()

// Update variant status
const response = await fetch('/commerce/variants/1/status', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'active',
  }),
})
const success = await response.json()

// Delete a variant
await fetch('/commerce/variants/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the variant data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "product_id": 1,
  "sku": "TSHIRT-S-RED",
  "title": "T-Shirt - Small - Red",
  "price": 29.99,
  "compare_at_price": 39.99,
  "inventory_quantity": 100,
  "inventory_policy": "deny",
  "inventory_management": "shopify",
  "options": ["Small", "Red"],
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Product Variants module includes built-in error handling for common scenarios:

- Attempting to update or delete a non-existent variant will throw an error
- Missing required fields during creation will throw an error
- Invalid option combinations will throw an error
- All database operations are wrapped in try-catch blocks to provide meaningful error messages
- Bulk operations are wrapped in transactions to ensure data consistency
- Variant options are validated to ensure proper formatting

This documentation covers the basic operations available in the Product Variants module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
