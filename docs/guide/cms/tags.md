# Tags

The Tags module in the CMS package provides a comprehensive set of functions to manage and interact with your content tags. This guide will walk you through the various operations you can perform with tags.

## Making Models Taggable

The tags functionality is implemented as a trait that can be added to any model. To make your model taggable, add the `taggable` trait to your model definition:

```ts
export default {
  name: 'Post',
  table: 'posts',
  
  traits: {
    taggable: true,  // Enable tags for this model
    // ... other traits
  },

  // ... rest of model definition
} satisfies Model
```

When you add the `taggable` trait to a model:

1. The model automatically gets the ability to have tags
2. The appropriate database relationships are set up
3. All tag-related functionality becomes available for that model
4. The model can be referenced in tags via `taggable_type`

## Model Methods

When you add the `taggable` trait to a model, it automatically gains several methods for working with tags. Here's how to use them:

```ts
// First, get your model instance
const post = await Post.find(1)

// Get all tags for this post
const tags = await post.tags(id)

// Get the tag count
const count = await post.tagCount(id)

// Add a new tag
const newTag = await post.addTag(id, {
  name: 'technology',
  description: 'Tech-related content'
})

// Get tags by status
const activeTags = await post.activeTags(id)
const inactiveTags = await post.inactiveTags(id)

// Remove a tag
await post.removeTag(id, tagId)
```

These methods make it easy to work with tags directly from your model instances, providing a more intuitive and object-oriented way to manage tags.

## Getting Started

First, import the tags functionality from the CMS package:

```ts
import { useTaggables } from '@stacksjs/cms'

const { 
  taggables,
  fetchTaggables,
  createTaggable,
  updateTaggable,
  deleteTaggable 
} = useTaggables()
```

## Basic Operations

### Fetch All Tags

```ts
const allTags = await fetchTaggables()
```

### Create a New Tag

```ts
const newTag = await createTaggable({
  name: 'technology',
  description: 'Technology-related content'
})
```

### Update a Tag

```ts
const updatedTag = await updateTaggable(1, {
  name: 'tech',
  description: 'Updated description'
})
```

### Delete a Tag

```ts
const success = await deleteTaggable(1) // Replace 1 with the tag ID to delete
```

## Advanced Tag Operations

### Find or Create a Tag

If you want to ensure a tag exists without creating duplicates:

```ts
const tag = await firstOrCreate('technology', 'posts', 'Optional description')
```

### Tag Statistics

#### Count Tagged Posts

```ts
const taggedPostsCount = await countTaggedPosts('posts')
```

#### Count Total Tags

```ts
const totalTags = await countTotalTags()
```

### Tag Analytics

#### Find Most Used Tag

```ts
const mostUsed = await findMostUsedTag()
// Or for specific content type
const mostUsedInPosts = await findMostUsedTag('posts')
```

#### Find Least Used Tag

```ts
const leastUsed = await findLeastUsedTag()
```

#### Get Tag Distribution

Get tag usage statistics for visualization:

```ts
const distribution = await fetchTagDistribution()
// Returns: Array<{ name: string, count: number, percentage: number }>
```

#### Get Tags with Post Counts

```ts
const tagsWithCounts = await fetchTagsWithPostCounts()
// Returns: Array<{ name: string, postCount: number }>
```

## Working with Tag Storage

The tags system uses VueUse's `useStorage` for client-side persistence:

```ts
// Access the reactive tags array
console.log(taggables.value)
```

## Error Handling

All tag operations include built-in error handling. Here's an example of how errors are handled:

```ts
try {
  const tag = await createTaggable({
    name: 'new-tag'
  })
} catch (error) {
  console.error('Failed to create tag:', error)
}
```

## Type Definitions

The tag system is fully typed. Here's what a tag object looks like:

```ts
interface Taggables {
  id: number
  name: string
  description?: string
  taggable_type: string
  created_at: string
  updated_at: string
  is_active: boolean
}
```

This documentation covers both basic and advanced operations available in the Tags module. The system is designed to be type-safe and provides robust error handling out of the box.

## API Endpoints

The Tags module provides RESTful API endpoints for managing tags. All endpoints are prefixed with `/cms`.

```
GET    /cms/taggables              # List all tags
POST   /cms/taggables              # Create a new tag
GET    /cms/taggables/{id}         # Get a specific tag
PATCH  /cms/taggables/{id}         # Update a tag
DELETE /cms/taggables/{id}         # Delete a tag
```

### Example Usage

```ts
// List all tags
const response = await fetch('/cms/taggables')
const tags = await response.json()

// Create a new tag
const response = await fetch('/cms/taggables', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'technology',
    description: 'Tech-related content'
  }),
})
const newTag = await response.json()

// Update a tag
const response = await fetch('/cms/taggables/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'tech',
    description: 'Updated description'
  }),
})
const updatedTag = await response.json()

// Delete a tag
await fetch('/cms/taggables/1', {
  method: 'DELETE',
})
```
