# Categories

The Categories module in the CMS package provides a comprehensive set of functions to manage and organize your content through categories. This guide will walk you through the various operations you can perform with categories.

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

This documentation covers both basic and advanced operations available in the Categories module. The system is designed to be type-safe and provides robust error handling out of the box.
