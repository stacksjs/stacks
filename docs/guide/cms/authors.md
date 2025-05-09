# Authors

The Authors module in the CMS package provides functionality to manage content authors. This guide will walk you through the various operations you can perform with authors.

## Getting Started

First, import the authors functionality from the CMS package:

```ts
import { authors } from '@stacksjs/cms'
```

## Finding Authors

The module provides several ways to find authors:

```ts
// Find by email
const author = await authors.findByEmail('author@example.com')

// Find by name
const author = await authors.findByName('John Doe')

// Find by user ID
const author = await authors.findByUserId(1)

// Find by UUID
const author = await authors.findByUuid('author-uuid')
```

## Creating Authors

You can create authors in two ways:

```ts
// Create a new author
const newAuthor = await authors.store({
  name: 'John Doe',
  email: 'john@example.com',
  // ... other author attributes
})

// Find existing author or create new one
const author = await authors.findOrCreate({
  name: 'John Doe',
  email: 'john@example.com',
  // ... other author attributes
})
```

## Updating Authors

```ts
const updatedAuthor = await authors.update(authorId, {
  name: 'Updated Name',
  email: 'updated@example.com',
  // ... other attributes to update
})
```

## Deleting Authors

```ts
// Delete an author by ID
await authors.destroy(authorId)
```

## Error Handling

The authors module includes built-in error handling. Here's an example:

```ts
try {
  const author = await authors.findByEmail('nonexistent@example.com')
  if (!author) {
    console.log('Author not found')
    return
  }
  // Work with the author...
} catch (error) {
  console.error('Error finding author:', error)
}
```

## Working with Posts and Authors

Since authors are typically associated with posts, here's how to work with both:

```ts
// Find an author and their posts
const author = await authors.findByEmail('author@example.com')
if (author) {
  // The actual method to get posts may vary based on your implementation
  const authorPosts = await posts.fetchByAuthor(author.id)
}
```

The Authors module provides a straightforward way to manage content creators in your CMS, with robust support for finding, creating, updating, and deleting author records.
