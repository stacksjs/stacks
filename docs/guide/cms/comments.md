# Comments

The Comments module in the CMS package provides a robust set of functions to manage and interact with comments across your content. This guide will walk you through the various operations you can perform with comments.

## Making Models Commentable

The comments functionality is implemented as a trait that can be added to any model. To make your model commentable, add the `commentables` trait to your model definition:

```ts
export default {
  name: 'Post',
  table: 'posts',
  
  traits: {
    commentables: true,  // Enable comments for this model
    // ... other traits
  },

  // ... rest of model definition
} satisfies Model
```

When you add the `commentables` trait to a model:

1. The model automatically gets the ability to have comments
2. The appropriate database relationships are set up
3. All comment-related functionality becomes available for that model
4. The model can be referenced in comments via `commentables_type`

## Model Methods

When you add the `commentables` trait to a model, it automatically gains several methods for working with comments. Here's how to use them:

```ts
// First, get your model instance
const post = await Post.find(1)

// Get all comments for this post
const comments = await post.comments()

// Get the comment count
const count = await post.commentCount(id)

// Add a new comment
await post.addComment(id, {
  title: 'Great Post!',
  body: 'This was very informative...'
})

// Get comments by status
const approved = await post.approvedComments(id)
const pending = await post.pendingComments(id)
const rejected = await post.rejectedComments(id)
```

These methods make it easy to work with comments directly from your model instances, providing a more intuitive and object-oriented way to manage comments.

## Getting Started

First, import the comments functionality from the CMS package:

```ts
import { comments } from '@stacksjs/cms'
```

## Basic Operations

### Fetch Comments

You can fetch comments with various filtering options:

```ts
// Fetch all comments with optional filters
const allComments = await comments.fetchComments({
  status: 'approved',        // Optional: Filter by status
  commentables_id: 1,        // Optional: Filter by parent content ID
  commentables_type: 'posts', // Optional: Filter by content type
  limit: 10,                 // Optional: Limit results
  offset: 0                  // Optional: Pagination offset
})

// Fetch a single comment by ID
const comment = await comments.fetchCommentById(1)

// Fetch comments for a specific content
const contentComments = await comments.fetchCommentsByCommentables(
  1,                // commentables_id
  'posts',         // commentables_type
  {
    status: 'approved',
    limit: 10,
    offset: 0
  }
)

// Fetch comments by status
const approvedComments = await comments.fetchCommentsByStatus('approved', {
  limit: 10,
  offset: 0
})
```

### Create a Comment

```ts
const newComment = await comments.store({
  title: 'Great Article!',
  body: 'This was very informative...',
  status: 'pending',
  commentables_id: 1,        // ID of the content being commented on
  commentables_type: 'posts', // Type of content
  user_id: 1,                // ID of the commenting user
  is_active: true
})
```

### Update a Comment

```ts
const updatedComment = await comments.update(1, {
  title: 'Updated Title',
  body: 'Updated content...',
  status: 'approved',
  approved_at: Date.now()
})
```

### Delete Comments

```ts
// Delete a single comment
const success = await comments.destroy(1)

// Bulk delete comments
const deletedCount = await comments.bulkDestroy([1, 2, 3])
```

## Comment Analytics

The Comments module includes several analytics functions:

### Comment Counts and Statistics

```ts
// Get comment count for a specific period
const periodStats = await comments.fetchCommentCountByPeriod()

// Calculate approval rate
const approvalRate = await comments.calculateApprovalRate()

// Get posts with most comments
const popularPosts = await comments.fetchPostsWithMostComments()

// Get comment distribution data for graphs
const barGraphData = await comments.fetchCommentCountBarGraph()
const donutData = await comments.fetchStatusDistributionDonut()
const monthlyData = await comments.fetchMonthlyCommentCounts()
```

## Type Definitions

The comment system is fully typed. Here's what a comment object looks like:

```ts
interface Commentable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  reports_count?: number
  reported_at?: number | null
  upvotes_count?: number
  downvotes_count?: number
  user_id: number | null
  created_at?: string
  updated_at?: string | null
}

type CommentStatus = 'approved' | 'pending' | 'spam'
```

## Error Handling

The comment system includes built-in error handling. Here's an example:

```ts
try {
  const comment = await comments.store({
    title: 'New Comment',
    body: 'Comment content',
    status: 'pending',
    commentables_id: 1,
    commentables_type: 'posts',
    user_id: 1
  })
} catch (error) {
  console.error('Failed to create comment:', error)
}
```

## Best Practices

1. **Status Management**: Use appropriate status values ('approved', 'pending', 'spam') to manage comment workflow
2. **Content Association**: Always specify both `commentables_id` and `commentables_type` when creating comments
3. **Pagination**: Use limit and offset parameters for large comment sets
4. **Moderation**: Implement appropriate approval workflows using the status and approval timestamps
5. **User Association**: Always associate comments with users when possible using `user_id`

## Working with Posts and Comments

To manage comments on posts:

```ts
// Fetch all comments for a specific post
const postComments = await comments.fetchCommentsByCommentables(
  postId,
  'posts',
  { status: 'approved' }
)

// Create a new comment on a post
const newComment = await comments.store({
  title: 'Great Post!',
  body: 'Very informative content...',
  status: 'pending',
  commentables_id: postId,
  commentables_type: 'posts',
  user_id: currentUserId
})
```

This documentation covers both basic and advanced operations available in the Comments module. The system is designed to be type-safe and provides robust error handling out of the box.
