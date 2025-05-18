# Pages

The Pages module in the CMS package provides a set of functions to manage and interact with your static pages. This guide will walk you through the various operations you can perform with pages.

## Getting Started

First, import the pages functionality from the CMS package:

```ts
import { pages } from '@stacksjs/cms'
```

## Fetching Pages

The CMS provides several methods to fetch pages based on different criteria:

### Fetch All Pages

```ts
const allPages = await pages.fetchAll()
```

### Fetch a Single Page

```ts
const page = await pages.fetchById(1) // Replace 1 with the actual page ID
```

### Fetch Pages by Author

```ts
const authorPages = await pages.fetchByAuthor(1) // Replace 1 with the author ID
```

### Fetch Pages by Views

```ts
const popularPages = await pages.fetchByMinViews(1000) // Pages with at least 1000 views
```

### Fetch Pages by Conversions

```ts
const highConversionPages = await pages.fetchByMinConversions(100) // Pages with at least 100 conversions
```

### Fetch Pages Published After a Date

```ts
const recentPages = await pages.fetchPublishedAfter(1704067200) // Unix timestamp
```

## Managing Pages

### Store a New Page

```ts
const newPage = await pages.store({
  author_id: 1,
  title: 'My New Page',
  template: 'default',
  views: 0,
  conversions: 0,
})
```

### Update a Page

```ts
const updatedPage = await pages.update(1, {
  title: 'Updated Title',
  template: 'custom',
  // ... other page attributes
})
```

### Delete Pages

Single page deletion:
```ts
await pages.destroy(1) // Replace 1 with the page ID to delete
```

Bulk deletion:
```ts
await pages.bulkDestroy([1, 2, 3]) // Array of page IDs to delete
```

## API Endpoints

The Pages module provides RESTful API endpoints for managing pages. All endpoints are prefixed with `/cms`.

```
GET    /cms/pages              # List all pages
POST   /cms/pages              # Create a new page
GET    /cms/pages/{id}         # Get a specific page
PATCH  /cms/pages/{id}         # Update a page
DELETE /cms/pages/{id}         # Delete a page
```

### Example Usage

```ts
// List all pages
const response = await fetch('/cms/pages')
const pages = await response.json()

// Create a new page
const response = await fetch('/cms/pages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'My New Page',
    template: 'default',
    author_id: 1,
    views: 0,
    conversions: 0,
  }),
})
const newPage = await response.json()

// Get a specific page
const response = await fetch('/cms/pages/1')
const page = await response.json()

// Update a page
const response = await fetch('/cms/pages/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Updated Title',
    template: 'custom',
  }),
})
const updatedPage = await response.json()

// Delete a page
await fetch('/cms/pages/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the page data with all its attributes:

```json
{
  "id": 1,
  "title": "My Page",
  "template": "default",
  "views": 0,
  "conversions": 0,
  "author_id": 1,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

This documentation covers the basic operations available in the Pages module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
