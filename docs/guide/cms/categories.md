# Categories

The Categories module in the CMS package provides a comprehensive set of functions to manage and organize your content through categories. This guide will walk you through the various operations you can perform with categories.

## Making Models Categorizable

The categories functionality is implemented as a trait that can be added to any model. To make your model categorizable, add the `categorizable` trait to your model definition:

```ts
export default {
  name: 'Post',
  table: 'posts',
  
  traits: {
    categorizable: true,  // Enable categories for this model
    // ... other traits
  },

  // ... rest of model definition
} satisfies Model
```

When you add the `categorizable` trait to a model:

1. The model automatically gets the ability to have categories
2. The appropriate database relationships are set up
3. All category-related functionality becomes available for that model
4. The model can be referenced in categories via `categorizable_type`

## Model Methods

When you add the `categorizable` trait to a model, it automatically gains several methods for working with categories. Here's how to use them:

```ts
// First, get your model instance
const post = await Post.find(1)

// Get all categories for this post
const categories = await post.categories()

// Get the category count
const count = await post.categoryCount(id)

// Add a new category
const newCategory = await post.addCategory(id, {
  name: 'Technology',
  description: 'Tech-related content'
})

// Get categories by status
const activeCategories = await post.activeCategories(id)
const inactiveCategories = await post.inactiveCategories(id)

// Remove a category
await post.removeCategory(id, categoryId)

// Set primary category
await post.setPrimaryCategory(id, categoryId)

// Get primary category
const primaryCategory = await post.primaryCategory(id)
```

These methods make it easy to work with categories directly from your model instances, providing a more intuitive and object-oriented way to manage categories.

## Getting Started

First, import the categories functionality from the CMS package:

```ts
import { useCategorizables } from '@stacksjs/cms'

const { 
  categorizables,
  fetchCategorizables,
  createCategorizable,
  updateCategorizable,
  deleteCategorizable 
} = useCategorizables()
```

## Basic Operations

### Fetch All Categories

```ts
const allCategories = await fetchCategorizables()
```

### Create a New Category

```ts
const newCategory = await createCategorizable({
  name: 'Technology',
  description: 'Technology-related content',
  categorizable_type: 'posts',
  is_active: true
})
```

### Update a Category

```ts
const updatedCategory = await updateCategorizable(1, {
  name: 'Tech',
  description: 'Updated description',
  is_active: true
})
```

### Delete a Category

```ts
const success = await deleteCategorizable(1) // Replace 1 with the category ID to delete
```

## Advanced Category Operations

### Find or Create a Category

If you want to ensure a category exists without creating duplicates:

```ts
const category = await firstOrCreate('Technology', 'posts', 'Optional description')
```

### Fetch Categories by Different Criteria

#### Fetch by ID

```ts
const category = await fetchById(1)
```

#### Fetch by Name

```ts
const categories = await fetchByName('Technology')
```

#### Fetch by Slug

```ts
const category = await fetchBySlug('technology')
```

#### Fetch with Associated Posts

```ts
const categoryWithPosts = await fetchWithPosts(1)
```

### Bulk Operations

#### Bulk Create Categories

```ts
const categoriesData = [
  {
    name: 'Technology',
    description: 'Tech content',
    categorizable_type: 'posts'
  },
  {
    name: 'Science',
    description: 'Science content',
    categorizable_type: 'posts'
  }
]

const createdCategories = await bulkStore(categoriesData)
```

#### Bulk Delete Categories

```ts
const deletedCount = await bulkDestroy([1, 2, 3]) // Array of category IDs
```

## Working with Category Storage

The categories system uses VueUse's `useStorage` for client-side persistence:

```ts
// Access the reactive categories array
console.log(categorizables.value)
```

## Type Definitions

The category system is fully typed. Here's what a category object looks like:

```ts
interface Categorizables {
  id: number
  name: string
  slug: string // Auto-generated from name
  description?: string
  categorizable_type: string
  is_active: boolean
  created_at: string
  updated_at: string
}
```

## Error Handling

The category system includes built-in error handling. Here's an example:

```ts
try {
  const category = await createCategorizable({
    name: 'New Category',
    categorizable_type: 'posts'
  })
} catch (error) {
  console.error('Failed to create category:', error)
}
```

## Best Practices

1. **Slugs**: Categories automatically generate URL-friendly slugs from their names
2. **Types**: Always specify the `categorizable_type` when creating categories (e.g., 'posts', 'products')
3. **Active Status**: Use the `is_active` flag to soft-disable categories without deleting them
4. **Validation**: Ensure category names are unique within their `categorizable_type`

## Using Categories with Posts

To associate posts with categories:

```ts
// When creating a post
const category = await categories.findOrCreateByName({
  name: 'Technology',
  categorizable_type: 'posts'
})

// Attach category to post
await posts.attach(postId, 'categorizable_models', [category.id])

// Or sync categories (replace all categories)
await posts.sync(postId, 'categorizable_models', [category.id])

// Fetch posts by category
const postsInCategory = await posts.fetchByCategory('Technology')
```

## API Endpoints

The Categories module provides RESTful API endpoints for managing categories. All endpoints are prefixed with `/cms`.

```
GET    /cms/categorizables              # List all categories
POST   /cms/categorizables              # Create a new category
GET    /cms/categorizables/{id}         # Get a specific category
PATCH  /cms/categorizables/{id}         # Update a category
DELETE /cms/categorizables/{id}         # Delete a category
```

### Example Usage

```ts
// List all categories
const response = await fetch('/cms/categorizables')
const categories = await response.json()

// Create a new category
const response = await fetch('/cms/categorizables', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Technology',
    description: 'Tech-related content'
  }),
})
const newCategory = await response.json()

// Update a category
const response = await fetch('/cms/categorizables/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Tech',
    description: 'Updated description'
  }),
})
const updatedCategory = await response.json()

// Delete a category
await fetch('/cms/categorizables/1', {
  method: 'DELETE',
})
```

This documentation covers both basic and advanced operations available in the Categories module. The system is designed to be type-safe and provides robust error handling out of the box.
