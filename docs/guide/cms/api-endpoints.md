# CMS API Endpoints

The CMS package provides a set of RESTful API endpoints for managing content. All endpoints are prefixed with `/cms`.

## Posts Endpoints

```
GET    /cms/posts              # List all posts
POST   /cms/posts              # Create a new post
GET    /cms/posts/{id}         # Get a specific post
PATCH  /cms/posts/{id}         # Update a post
DELETE /cms/posts/{id}         # Delete a post
```

## Pages Endpoints

```
GET    /cms/pages              # List all pages
POST   /cms/pages              # Create a new page
GET    /cms/pages/{id}         # Get a specific page
PATCH  /cms/pages/{id}         # Update a page
DELETE /cms/pages/{id}         # Delete a page
```

## Categories Endpoints

```
GET    /cms/categorizables              # List all categories
POST   /cms/categorizables              # Create a new category
GET    /cms/categorizables/{id}         # Get a specific category
PATCH  /cms/categorizables/{id}         # Update a category
DELETE /cms/categorizables/{id}         # Delete a category
```

## Tags Endpoints

```
GET    /cms/taggables              # List all tags
POST   /cms/taggables              # Create a new tag
GET    /cms/taggables/{id}         # Get a specific tag
PATCH  /cms/taggables/{id}         # Update a tag
DELETE /cms/taggables/{id}         # Delete a tag
```

## Making API Requests

Here are examples of how to use these endpoints:

### Fetching Posts

```ts
// List all posts
const response = await fetch('/cms/posts')
const posts = await response.json()

// Get a specific post
const response = await fetch('/cms/posts/1')
const post = await response.json()
```

### Creating Content

```ts
// Create a new post
const response = await fetch('/cms/posts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'My New Post',
    content: 'Post content...',
    // ... other post attributes
  }),
})
const newPost = await response.json()
```

### Updating Content

```ts
// Update a post
const response = await fetch('/cms/posts/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Updated Title',
    // ... other attributes to update
  }),
})
const updatedPost = await response.json()
```

### Deleting Content

```ts
// Delete a post
await fetch('/cms/posts/1', {
  method: 'DELETE',
})
```

## Response Format

All API endpoints return JSON responses. A successful response typically includes the requested data:

```json
{
  "id": 1,
  "title": "My Post",
  "content": "Post content...",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

Error responses include an error message:

```json
{
  "error": "Post not found"
}
```

## Authentication

These endpoints may require authentication depending on your application's configuration. Make sure to include the appropriate authentication headers with your requests. 