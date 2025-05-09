# Posts

The Posts module in the CMS package provides a robust set of functions to manage and interact with your content. This guide will walk you through the various operations you can perform with posts.

## Getting Started

First, import the posts functionality from the CMS package:

```ts
import { posts } from '@stacksjs/cms'
```

## Fetching Posts

The CMS provides several methods to fetch posts based on different criteria:

### Fetch All Posts

```ts
const allPosts = await posts.fetchAll()
```

### Fetch a Single Post

```ts
const post = await posts.fetchById(1) // Replace 1 with the actual post ID
```

### Fetch Posts by Author

```ts
const authorPosts = await posts.fetchByAuthor('john.doe')
```

### Fetch Posts by Category

```ts
const categoryPosts = await posts.fetchByCategory('technology')
```

### Fetch Posts by Minimum Views

```ts
const popularPosts = await posts.fetchByMinViews(1000) // Posts with at least 1000 views
```

### Fetch Posts by Status

```ts
const publishedPosts = await posts.fetchByStatus('published')
```

### Fetch Posts Published After a Date

```ts
const recentPosts = await posts.fetchPublishedAfter('2024-01-01')
```

## Managing Posts

### Store a New Post

```ts
const newPost = await posts.store({
  title: 'My New Post',
  content: 'Post content goes here',
  // ... other post attributes
})
```

### Update a Post

```ts
const updatedPost = await posts.update(1, {
  title: 'Updated Title',
  content: 'Updated content',
})
```

### Delete Posts

Single post deletion:
```ts
await posts.destroy(1) // Replace 1 with the post ID to delete
```

Bulk deletion:
```ts
await posts.bulkDestroy([1, 2, 3]) // Array of post IDs to delete
```

## Working with Tags

### Attach Tags to a Post

```ts
await posts.attach(postId, {
  tags: ['technology', 'programming']
})
```

### Detach Tags from a Post

```ts
await posts.detach(postId, {
  tags: ['technology']
})
```

### Sync Tags (Replace all tags)

```ts
await posts.sync(postId, {
  tags: ['new-tag-1', 'new-tag-2']
})
```

## API Endpoints

The Posts module provides RESTful API endpoints for managing posts. All endpoints are prefixed with `/cms`.

```
GET    /cms/posts              # List all posts
POST   /cms/posts              # Create a new post
GET    /cms/posts/{id}         # Get a specific post
PATCH  /cms/posts/{id}         # Update a post
DELETE /cms/posts/{id}         # Delete a post
```

### Example Usage

```ts
// List all posts
const response = await fetch('/cms/posts')
const posts = await response.json()

// Create a new post
const response = await fetch('/cms/posts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'My New Post',
    content: 'Post content...',
    excerpt: 'Post excerpt...',
    status: 'draft',
    // ... other post attributes
  }),
})
const newPost = await response.json()

// Get a specific post
const response = await fetch('/cms/posts/1')
const post = await response.json()

// Update a post
const response = await fetch('/cms/posts/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Updated Title',
    content: 'Updated content...',
    status: 'published'
  }),
})
const updatedPost = await response.json()

// Delete a post
await fetch('/cms/posts/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the post data with all its attributes:

```json
{
  "id": 1,
  "title": "My Post",
  "content": "Post content...",
  "excerpt": "Post excerpt...",
  "status": "published",
  "views": 0,
  "author_id": 1,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

This documentation covers the basic operations available in the Posts module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
