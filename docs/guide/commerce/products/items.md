# Product Items

The Product Items module in the Commerce package provides a robust set of functions to manage and interact with your product item data. This guide will walk you through the various operations you can perform with product items.

## Getting Started

First, import the product items functionality from the Commerce package:

```ts
import { products } from '@stacksjs/commerce'
```

## Fetching Product Items

The Commerce package provides several methods to fetch product items:

### Fetch All Product Items

```ts
const allItems = await products.items.fetchAll()
```

### Fetch a Single Product Item

```ts
const item = await products.items.fetchById(1) // Replace 1 with the actual product item ID
```

## Managing Product Items

### Store a New Product Item

```ts
const newItem = await products.items.store({
  product_id: 1,
  sku: 'SKU123',
  price: 99.99,
  inventory_count: 100,
  is_available: true,
  // ... other product item attributes
})
```

### Store Multiple Product Items

```ts
const newItems = await products.items.bulkStore([
  {
    product_id: 1,
    sku: 'SKU123',
    price: 99.99,
    inventory_count: 100,
    is_available: true,
  },
  {
    product_id: 2,
    sku: 'SKU124',
    price: 149.99,
    inventory_count: 50,
    is_available: true,
  },
])
```

### Update a Product Item

```ts
const updatedItem = await products.items.update(1, {
  price: 129.99,
  inventory_count: 75,
})
```

### Update Multiple Product Items

```ts
const updatedItems = await products.items.bulkUpdate([
  {
    id: 1,
    price: 129.99,
    inventory_count: 75,
  },
  {
    id: 2,
    price: 179.99,
    inventory_count: 25,
  },
])
```

### Update Product Item Availability

```ts
const updatedItem = await products.items.updateAvailability(1, false) // Set to unavailable
```

### Update Product Item Inventory

```ts
const updatedItem = await products.items.updateInventory(1, 50) // Update inventory count to 50
```

### Delete Product Items

Single product item deletion:

```ts
await products.items.destroy(1) // Replace 1 with the product item ID to delete
```

Bulk deletion:

```ts
await products.items.bulkDestroy([1, 2, 3]) // Array of product item IDs to delete
```

## API Endpoints

The Product Items module provides RESTful API endpoints for managing product items. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/products/items              # List all product items
POST   /commerce/products/items              # Create a new product item
POST   /commerce/products/items/bulk         # Create multiple product items
GET    /commerce/products/items/{id}         # Get a specific product item
PATCH  /commerce/products/items/{id}         # Update a product item
PATCH  /commerce/products/items/bulk         # Update multiple product items
PATCH  /commerce/products/items/{id}/availability  # Update availability
PATCH  /commerce/products/items/{id}/inventory     # Update inventory
DELETE /commerce/products/items/{id}         # Delete a product item
DELETE /commerce/products/items/bulk         # Delete multiple product items
```

### Example Usage

```ts
// List all product items
const response = await fetch('/commerce/products/items')
const items = await response.json()

// Create a new product item
const response = await fetch('/commerce/products/items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    product_id: 1,
    sku: 'SKU123',
    price: 99.99,
    inventory_count: 100,
    is_available: true,
  }),
})
const newItem = await response.json()

// Get a specific product item
const response = await fetch('/commerce/products/items/1')
const item = await response.json()

// Update a product item
const response = await fetch('/commerce/products/items/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    price: 129.99,
    inventory_count: 75,
  }),
})
const updatedItem = await response.json()

// Update availability
const response = await fetch('/commerce/products/items/1/availability', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    is_available: false,
  }),
})
const updatedItem = await response.json()

// Delete a product item
await fetch('/commerce/products/items/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the product item data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "product_id": 1,
  "sku": "SKU123",
  "price": 99.99,
  "inventory_count": 100,
  "is_available": true,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Product Items module includes built-in error handling for common scenarios:

- Attempting to update or delete a non-existent product item will throw an error
- Missing required fields during creation will throw an error
- Invalid inventory counts will throw an error
- All database operations are wrapped in try-catch blocks to provide meaningful error messages
- Bulk operations are wrapped in transactions to ensure data consistency

This documentation covers the basic operations available in the Product Items module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
