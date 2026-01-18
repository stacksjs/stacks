# CMS Package

A headless content management system providing posts, pages, authors, categories, tags, and comments management with full API support.

## Installation

```bash
bun add @stacksjs/cms
```

## Basic Usage

```typescript
import { cms } from '@stacksjs/cms'

// Create a post
const post = await cms.posts.store({
  title: 'Getting Started with Stacks',
  content: 'Welcome to Stacks...',
  status: 'published'
})

// Create a page
const page = await cms.pages.store({
  title: 'About Us',
  slug: 'about',
  content: 'About our company...'
})
```

## Posts

### Creating Posts

```typescript
import { cms } from '@stacksjs/cms'

// Create a basic post
const post = await cms.posts.store({
  title: 'My First Post',
  slug: 'my-first-post',
  content: 'This is the full content of the post...',
  excerpt: 'A brief summary of the post',
  status: 'draft', // 'draft', 'published', 'scheduled', 'archived'
  authorId: 1,
  publishedAt: new Date(),
  featuredImage: '/images/post-cover.jpg',
  metaTitle: 'My First Post | Blog',
  metaDescription: 'Learn about our first post...'
})
```

### Fetching Posts

```typescript
// Get all published posts
const posts = await cms.posts.fetch({
  status: 'published',
  orderBy: 'publishedAt',
  order: 'desc',
  limit: 10,
  offset: 0
})

// Get post by slug
const post = await cms.posts.fetch({
  slug: 'my-first-post'
})

// Get posts with relationships
const postsWithRelations = await cms.posts.fetch({
  include: ['author', 'categories', 'tags', 'comments'],
  status: 'published'
})

// Search posts
const searchResults = await cms.posts.fetch({
  search: 'typescript',
  searchFields: ['title', 'content', 'excerpt']
})
```

### Updating Posts

```typescript
// Update post
await cms.posts.update(postId, {
  title: 'Updated Title',
  content: 'Updated content...',
  status: 'published'
})

// Publish draft
await cms.posts.update(postId, {
  status: 'published',
  publishedAt: new Date()
})

// Schedule post
await cms.posts.update(postId, {
  status: 'scheduled',
  publishedAt: new Date('2024-06-01 09:00:00')
})
```

### Deleting Posts

```typescript
// Soft delete (archive)
await cms.posts.destroy(postId)

// Hard delete
await cms.posts.destroy(postId, { force: true })
```

## Pages

### Creating Pages

```typescript
// Create a page
const page = await cms.pages.store({
  title: 'About Us',
  slug: 'about',
  content: `
    <h2>Our Story</h2>
    <p>We started in 2020...</p>
  `,
  template: 'default', // Page template
  status: 'published',
  parentId: null, // For nested pages
  order: 1,
  metaTitle: 'About Us | Company Name',
  metaDescription: 'Learn about our company...'
})

// Create child page
const childPage = await cms.pages.store({
  title: 'Our Team',
  slug: 'team',
  parentId: page.id,
  content: 'Meet our team...'
})
```

### Fetching Pages

```typescript
// Get all published pages
const pages = await cms.pages.fetch({
  status: 'published'
})

// Get page by slug
const aboutPage = await cms.pages.fetch({
  slug: 'about'
})

// Get page hierarchy
const pageTree = await cms.pages.fetch({
  includeChildren: true,
  parentId: null // Get root pages with children
})

// Get pages by template
const landingPages = await cms.pages.fetch({
  template: 'landing'
})
```

### Updating Pages

```typescript
await cms.pages.update(pageId, {
  content: 'Updated content...',
  template: 'wide',
  order: 2
})
```

### Deleting Pages

```typescript
// Delete page (and optionally children)
await cms.pages.destroy(pageId)

// Delete with children
await cms.pages.destroy(pageId, { deleteChildren: true })
```

## Authors

### Creating Authors

```typescript
const author = await cms.authors.store({
  name: 'John Doe',
  email: 'john@example.com',
  bio: 'John is a senior developer and tech writer.',
  avatar: '/images/authors/john.jpg',
  website: 'https://johndoe.com',
  social: {
    twitter: '@johndoe',
    github: 'johndoe',
    linkedin: 'johndoe'
  },
  userId: 1 // Link to user account
})
```

### Fetching Authors

```typescript
// Get all authors
const authors = await cms.authors.fetch()

// Get author with posts
const authorWithPosts = await cms.authors.fetch({
  id: authorId,
  include: ['posts']
})

// Get authors with post count
const authorsWithCount = await cms.authors.fetch({
  withCount: ['posts']
})
```

### Updating Authors

```typescript
await cms.authors.update(authorId, {
  bio: 'Updated bio...',
  social: {
    twitter: '@newhandle'
  }
})
```

### Deleting Authors

```typescript
// Delete author (reassign posts)
await cms.authors.destroy(authorId, {
  reassignTo: otherAuthorId
})
```

## Categories (Categorizables)

### Creating Categories

```typescript
// Create category
const category = await cms.postCategories.store({
  name: 'Technology',
  slug: 'technology',
  description: 'Posts about technology',
  parentId: null,
  image: '/images/categories/tech.jpg'
})

// Create subcategory
const subcategory = await cms.postCategories.store({
  name: 'JavaScript',
  slug: 'javascript',
  parentId: category.id,
  description: 'JavaScript tutorials and news'
})
```

### Fetching Categories

```typescript
// Get all categories
const categories = await cms.postCategories.fetch()

// Get category tree
const categoryTree = await cms.postCategories.fetch({
  includeChildren: true,
  parentId: null
})

// Get category with posts
const categoryWithPosts = await cms.postCategories.fetch({
  slug: 'technology',
  include: ['posts']
})

// Get categories with post count
const categoriesWithCount = await cms.postCategories.fetch({
  withCount: ['posts']
})
```

### Assigning Categories

```typescript
// Assign categories to post
await cms.categorizable.store({
  postId: post.id,
  categoryIds: [category.id, subcategory.id]
})

// Update post categories
await cms.categorizable.update(post.id, {
  categoryIds: [newCategoryId]
})

// Remove category from post
await cms.categorizable.destroy({
  postId: post.id,
  categoryId: category.id
})
```

## Tags (Taggables)

### Creating Tags

```typescript
// Create tag
const tag = await cms.tags.store({
  name: 'TypeScript',
  slug: 'typescript',
  description: 'Posts about TypeScript'
})

// Create multiple tags
await cms.tags.storeMany([
  { name: 'React', slug: 'react' },
  { name: 'Vue', slug: 'vue' },
  { name: 'Svelte', slug: 'svelte' }
])
```

### Fetching Tags

```typescript
// Get all tags
const tags = await cms.tags.fetch()

// Get tags with post count
const tagsWithCount = await cms.tags.fetch({
  withCount: ['posts'],
  orderBy: 'postCount',
  order: 'desc'
})

// Get popular tags
const popularTags = await cms.tags.fetch({
  limit: 10,
  orderBy: 'postCount',
  order: 'desc'
})

// Search tags
const matchingTags = await cms.tags.fetch({
  search: 'java'
})
```

### Tagging Posts

```typescript
// Add tags to post
await cms.taggables.store({
  postId: post.id,
  tagIds: [tag1.id, tag2.id]
})

// Sync tags (replace all)
await cms.taggables.update(post.id, {
  tagIds: [newTag1.id, newTag2.id]
})

// Remove tag from post
await cms.taggables.destroy({
  postId: post.id,
  tagId: tag.id
})

// Fetch posts by tag
const postsWithTag = await cms.tags.fetch({
  slug: 'typescript',
  include: ['posts']
})
```

## Comments (Commentables)

### Creating Comments

```typescript
// Create comment
const comment = await cms.comments.store({
  postId: post.id,
  authorName: 'Jane Smith',
  authorEmail: 'jane@example.com',
  content: 'Great article! Very helpful.',
  status: 'pending', // 'pending', 'approved', 'spam', 'trash'
  userId: null // For guest comments
})

// Create reply
const reply = await cms.comments.store({
  postId: post.id,
  parentId: comment.id,
  authorName: 'John Doe',
  content: 'Thanks Jane!',
  status: 'approved'
})
```

### Fetching Comments

```typescript
// Get comments for post
const comments = await cms.comments.fetch({
  postId: post.id,
  status: 'approved',
  includeReplies: true
})

// Get comment tree (nested)
const commentTree = await cms.comments.fetch({
  postId: post.id,
  status: 'approved',
  parentId: null, // Root comments only
  includeReplies: true
})

// Get pending comments (moderation)
const pendingComments = await cms.comments.fetch({
  status: 'pending',
  orderBy: 'createdAt',
  order: 'asc'
})

// Count comments
const commentCount = await cms.comments.count({
  postId: post.id,
  status: 'approved'
})
```

### Comment Moderation

```typescript
// Approve comment
await cms.comments.update(commentId, {
  status: 'approved'
})

// Mark as spam
await cms.comments.update(commentId, {
  status: 'spam'
})

// Bulk moderation
await cms.comments.bulkUpdate({
  ids: [1, 2, 3],
  status: 'approved'
})

// Delete comment
await cms.comments.destroy(commentId)

// Delete with replies
await cms.comments.destroy(commentId, {
  deleteReplies: true
})
```

## Content Versioning

```typescript
// Posts automatically track revisions
const post = await cms.posts.store({
  title: 'My Post',
  content: 'Initial content'
})

// Update creates revision
await cms.posts.update(post.id, {
  content: 'Updated content'
})

// Get revisions
const revisions = await cms.posts.getRevisions(post.id)

// Restore revision
await cms.posts.restoreRevision(post.id, revisionId)

// Compare revisions
const diff = await cms.posts.compareRevisions(post.id, revisionId1, revisionId2)
```

## Media Management

```typescript
// Upload media
const media = await cms.media.store({
  file: uploadedFile,
  alt: 'Description of image',
  caption: 'Image caption',
  folder: 'posts/2024'
})

// Attach media to post
await cms.posts.update(post.id, {
  featuredImage: media.url
})

// Get media library
const mediaItems = await cms.media.fetch({
  type: 'image',
  folder: 'posts',
  search: 'logo'
})

// Delete media
await cms.media.destroy(mediaId)
```

## SEO

```typescript
// Set post SEO
await cms.posts.update(postId, {
  metaTitle: 'SEO Optimized Title | Brand',
  metaDescription: 'Meta description for search results...',
  canonicalUrl: 'https://example.com/post/original',
  noIndex: false,
  noFollow: false,
  ogTitle: 'Open Graph Title',
  ogDescription: 'Open Graph description',
  ogImage: '/images/og-post.jpg',
  twitterCard: 'summary_large_image'
})

// Generate sitemap data
const sitemapData = await cms.getSitemapData()
// Returns all published posts and pages with lastmod dates
```

## Content Scheduling

```typescript
// Schedule post for future publication
await cms.posts.store({
  title: 'Scheduled Post',
  content: '...',
  status: 'scheduled',
  publishedAt: new Date('2024-06-01 09:00:00')
})

// Get scheduled posts
const scheduledPosts = await cms.posts.fetch({
  status: 'scheduled',
  orderBy: 'publishedAt',
  order: 'asc'
})

// The scheduler automatically publishes when time arrives
```

## Content API

```typescript
// Full content API for headless usage
import { cms } from '@stacksjs/cms'

// REST-style API endpoints are auto-generated:
// GET /api/posts
// GET /api/posts/:slug
// GET /api/pages
// GET /api/pages/:slug
// GET /api/categories
// GET /api/tags
```

## Edge Cases

### Handling Slugs

```typescript
// Slugs are auto-generated if not provided
const post = await cms.posts.store({
  title: 'My Amazing Post!' // slug: 'my-amazing-post'
})

// Duplicate slugs get suffixed
const post2 = await cms.posts.store({
  title: 'My Amazing Post!' // slug: 'my-amazing-post-1'
})

// Custom slug
const post3 = await cms.posts.store({
  title: 'My Post',
  slug: 'custom-slug'
})
```

### Draft vs Published Content

```typescript
// Public API only returns published content
const publicPosts = await cms.posts.fetch({
  status: 'published'
})

// Admin API can access all statuses
const allPosts = await cms.posts.fetch({
  status: ['draft', 'published', 'scheduled']
})

// Preview draft content
const preview = await cms.posts.preview(draftPostId)
```

### Nested Comments

```typescript
// Comments support infinite nesting
const comment = await cms.comments.store({
  postId: post.id,
  parentId: parentCommentId,
  content: 'Reply to reply...'
})

// Get full comment thread
const thread = await cms.comments.getThread(postId, {
  maxDepth: 5 // Limit nesting depth
})
```

## API Reference

### Posts

| Method | Description |
|--------|-------------|
| `posts.store(data)` | Create post |
| `posts.fetch(filters)` | List posts |
| `posts.update(id, data)` | Update post |
| `posts.destroy(id)` | Delete post |
| `posts.getRevisions(id)` | Get revisions |
| `posts.restoreRevision(id, rev)` | Restore revision |

### Pages

| Method | Description |
|--------|-------------|
| `pages.store(data)` | Create page |
| `pages.fetch(filters)` | List pages |
| `pages.update(id, data)` | Update page |
| `pages.destroy(id)` | Delete page |

### Authors

| Method | Description |
|--------|-------------|
| `authors.store(data)` | Create author |
| `authors.fetch(filters)` | List authors |
| `authors.update(id, data)` | Update author |
| `authors.destroy(id)` | Delete author |

### Categories/Tags

| Method | Description |
|--------|-------------|
| `postCategories.store(data)` | Create category |
| `postCategories.fetch(filters)` | List categories |
| `tags.store(data)` | Create tag |
| `tags.fetch(filters)` | List tags |
| `categorizable.store(data)` | Assign categories |
| `taggables.store(data)` | Assign tags |

### Comments

| Method | Description |
|--------|-------------|
| `comments.store(data)` | Create comment |
| `comments.fetch(filters)` | List comments |
| `comments.update(id, data)` | Moderate comment |
| `comments.destroy(id)` | Delete comment |
| `comments.count(filters)` | Count comments |
