# Product Categories

The Product Categories module in the Commerce package provides a robust set of functions to manage and organize your product categories. This guide will walk you through the various operations you can perform with product categories.

## Getting Started

First, import the product categories functionality from the Commerce package:

```ts
import { products } from '@stacksjs/commerce'
```

## Fetching Categories

The Commerce package provides several methods to fetch categories:

### Fetch All Categories

```ts
const allCategories = await products.categories.fetchAll()
```

### Fetch a Single Category

```ts
const category = await products.categories.fetchById(1) // Replace 1 with the actual category ID
```

### Fetch by Name

```ts
const category = await products.categories.fetchByName('Electronics')
```

### Fetch Active Categories

```ts
const activeCategories = await products.categories.fetchActive()
```

### Fetch Root Categories

```ts
const rootCategories = await products.categories.fetchRootCategories()
```

### Fetch Child Categories

```ts
const childCategories = await products.categories.fetchChildCategories('1') // Replace 1 with the parent category ID
```

### Fetch by Display Order

```ts
// Fetch categories in ascending order
const categories = await products.categories.fetchByDisplayOrder(true)

// Fetch categories in descending order
const categories = await products.categories.fetchByDisplayOrder(false)
```

### Fetch Category Tree

```ts
const categoryTree = await products.categories.fetchCategoryTree()
```

### Fetch Category Statistics

```ts
const stats = await products.categories.fetchStats()
```

### Compare Category Growth

```ts
const growth = await products.categories.compareCategoryGrowth(30) // Compare last 30 days
```

## Managing Categories

### Store a New Category

```ts
const newCategory = await products.categories.store({
  name: 'Electronics',
  description: 'Electronic devices and accessories',
  image_url: 'https://example.com/electronics.jpg',
  is_active: true,
  parent_category_id: null,
  display_order: 1,
})
```

### Find or Create a Category

```ts
const category = await products.categories.findOrCreateByName({
  name: 'Electronics',
  description: 'Electronic devices and accessories',
  is_active: true,
})
```

### Update a Category

```ts
const updatedCategory = await products.categories.update(1, {
  name: 'Electronics',
  description: 'Updated description',
  image_url: 'https://example.com/new-image.jpg',
  is_active: true,
  display_order: 2,
})
```

### Update Display Order

```ts
const updatedCategory = await products.categories.updateDisplayOrder(1, 3) // Set display order to 3
```

### Update Active Status

```ts
const updatedCategory = await products.categories.updateActiveStatus(1, false) // Deactivate category
```

### Update Parent Category

```ts
// Move to a new parent
const updatedCategory = await products.categories.updateParent(1, '2') // Move category 1 under parent 2

// Make it a root category
const updatedCategory = await products.categories.updateParent(1, null)
```

### Delete Categories

Single category deletion:
```ts
await categories.remove(1) // Replace 1 with the category ID to delete
```

Bulk deletion:
```ts
await categories.bulkRemove([1, 2, 3]) // Array of category IDs to delete
```

### Remove Child Categories

```ts
const removedCount = await products.categories.removeChildCategories('1') // Remove all children of category 1
```

### Deactivate Categories

```ts
// Deactivate a single category
const success = await products.categories.deactivate(1)

// Deactivate all child categories
const deactivatedCount = await products.categories.deactivateChildCategories('1')
```

## API Endpoints

The Product Categories module provides RESTful API endpoints for managing categories. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/categories              # List all categories
POST   /commerce/categories              # Create a new category
GET    /commerce/categories/{id}         # Get a specific category
GET    /commerce/categories/name/{name}  # Get category by name
GET    /commerce/categories/active       # Get active categories
GET    /commerce/categories/root         # Get root categories
GET    /commerce/categories/{id}/children # Get child categories
GET    /commerce/categories/tree         # Get category tree
GET    /commerce/categories/stats        # Get category statistics
GET    /commerce/categories/growth       # Get category growth comparison
PATCH  /commerce/categories/{id}         # Update a category
PATCH  /commerce/categories/{id}/order   # Update display order
PATCH  /commerce/categories/{id}/status  # Update active status
PATCH  /commerce/categories/{id}/parent  # Update parent category
DELETE /commerce/categories/{id}         # Delete a category
DELETE /commerce/categories/bulk         # Delete multiple categories
DELETE /commerce/categories/{id}/children # Remove child categories
```

### Example Usage

```ts
// List all categories
const response = await fetch('/commerce/categories')
const categories = await response.json()

// Create a new category
const response = await fetch('/commerce/categories', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Electronics',
    description: 'Electronic devices and accessories',
    image_url: 'https://example.com/electronics.jpg',
    is_active: true,
    parent_category_id: null,
    display_order: 1,
  }),
})
const newCategory = await response.json()

// Get a specific category
const response = await fetch('/commerce/categories/1')
const category = await response.json()

// Update a category
const response = await fetch('/commerce/categories/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Electronics',
    description: 'Updated description',
    is_active: true,
  }),
})
const updatedCategory = await response.json()

// Delete a category
await fetch('/commerce/categories/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the category data with all its attributes:

```json
{
  "id": 1,
  "name": "Electronics",
  "description": "Electronic devices and accessories",
  "image_url": "https://example.com/electronics.jpg",
  "is_active": true,
  "parent_category_id": null,
  "display_order": 1,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Category Tree Response Format

When fetching the category tree:

```json
[
  {
    "id": 1,
    "name": "Electronics",
    "children": [
      {
        "id": 2,
        "name": "Smartphones",
        "children": []
      },
      {
        "id": 3,
        "name": "Laptops",
        "children": []
      }
    ]
  }
]
```

### Statistics Response Format

When fetching category statistics:

```json
{
  "total": 100,
  "active": 80,
  "root_categories": 10,
  "child_categories": 90,
  "with_images": 50,
  "recently_added": [
    {
      "id": 1,
      "name": "New Category",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "top_parent_categories": [
    {
      "id": "1",
      "name": "Electronics",
      "child_count": 20
    }
  ]
}
```

## Error Handling

The Product Categories module includes built-in error handling for common scenarios:

- Attempting to update or delete a non-existent category will throw an error
- Missing required fields during creation will throw an error
- Duplicate category names will throw an error
- Circular references in category hierarchy are prevented
- All database operations are wrapped in try-catch blocks to provide meaningful error messages
- Bulk operations are wrapped in transactions to ensure data consistency
- Parent-child relationships are validated to maintain data integrity

This documentation covers the basic operations available in the Product Categories module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
