# Tags

The Tags module in the CMS package provides a comprehensive set of functions to manage and interact with your content tags. This guide will walk you through the various operations you can perform with tags.

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
