# Reviews

The Reviews module in the Commerce package provides a robust set of functions to manage and interact with your product review data. This guide will walk you through the various operations you can perform with reviews.

## Getting Started

First, import the reviews functionality from the Commerce package:

```ts
import { products } from '@stacksjs/commerce'
```

## Fetching Reviews

The Commerce package provides several methods to fetch reviews:

### Fetch All Reviews

```ts
const allReviews = await products.reviews.fetchAll()
```

### Fetch a Single Review

```ts
const review = await products.reviews.fetchById(1) // Replace 1 with the actual review ID
```

### Fetch Reviews by Product

```ts
const productReviews = await products.reviews.fetchByProductId(1) // Replace 1 with the product ID
```

### Fetch Reviews by User

```ts
const userReviews = await products.reviews.fetchByUserId(1) // Replace 1 with the user ID
```

### Fetch Approved Reviews for a Product

```ts
const approvedReviews = await products.reviews.fetchApprovedByProductId(1) // Replace 1 with the product ID
```

### Fetch Most Helpful Reviews for a Product

```ts
const helpfulReviews = await products.reviews.fetchMostHelpfulByProductId(1) // Replace 1 with the product ID
```

## Managing Reviews

### Store a New Review

```ts
const newReview = await products.reviews.store({
  product_id: 1,
  customer_id: 1,
  rating: 5,
  title: 'Great Product!',
  content: 'This product exceeded my expectations.',
  is_verified_purchase: true,
  is_approved: false,
  helpful_votes: 0,
  unhelpful_votes: 0,
  is_featured: false,
  // ... other review attributes
})
```

### Update a Review

```ts
const updatedReview = await products.reviews.update(1, {
  rating: 4,
  content: 'Updated review content',
  is_approved: true,
})
```

### Update Review Votes

```ts
// Increment helpful votes
const updatedReview = await products.reviews.updateVotes(1, 'helpful', true)

// Decrement unhelpful votes
const updatedReview = await products.reviews.updateVotes(1, 'unhelpful', false)
```

### Delete Reviews

Single review deletion:
```ts
await products.reviews.destroy(1) // Replace 1 with the review ID to delete
```

Bulk deletion:
```ts
await products.reviews.bulkDestroy([1, 2, 3]) // Array of review IDs to delete
```

## API Endpoints

The Reviews module provides RESTful API endpoints for managing reviews. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/reviews              # List all reviews
POST   /commerce/reviews              # Create a new review
GET    /commerce/reviews/{id}         # Get a specific review
GET    /commerce/reviews/product/{id} # Get reviews for a product
GET    /commerce/reviews/user/{id}    # Get reviews by user
GET    /commerce/reviews/product/{id}/approved  # Get approved reviews for a product
GET    /commerce/reviews/product/{id}/helpful   # Get most helpful reviews for a product
PATCH  /commerce/reviews/{id}         # Update a review
PATCH  /commerce/reviews/{id}/votes   # Update review votes
DELETE /commerce/reviews/{id}         # Delete a review
DELETE /commerce/reviews/bulk         # Delete multiple reviews
```

### Example Usage

```ts
// List all reviews
const response = await fetch('/commerce/reviews')
const reviews = await response.json()

// Create a new review
const response = await fetch('/commerce/reviews', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    product_id: 1,
    customer_id: 1,
    rating: 5,
    title: 'Great Product!',
    content: 'This product exceeded my expectations.',
    is_verified_purchase: true,
  }),
})
const newReview = await response.json()

// Get a specific review
const response = await fetch('/commerce/reviews/1')
const review = await response.json()

// Update a review
const response = await fetch('/commerce/reviews/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    rating: 4,
    content: 'Updated review content',
    is_approved: true,
  }),
})
const updatedReview = await response.json()

// Update review votes
const response = await fetch('/commerce/reviews/1/votes', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    vote_type: 'helpful',
    increment: true,
  }),
})
const updatedReview = await response.json()

// Delete a review
await fetch('/commerce/reviews/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the review data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "product_id": 1,
  "customer_id": 1,
  "rating": 5,
  "title": "Great Product!",
  "content": "This product exceeded my expectations.",
  "is_verified_purchase": true,
  "is_approved": false,
  "helpful_votes": 0,
  "unhelpful_votes": 0,
  "is_featured": false,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Reviews module includes built-in error handling for common scenarios:

- Duplicate review entries will throw an error with the message "A review with this code already exists"
- Attempting to update or delete a non-existent review will throw an error
- Missing required fields during creation will throw an error
- Invalid vote operations will throw an error
- All database operations are wrapped in try-catch blocks to provide meaningful error messages
- Bulk operations are wrapped in transactions to ensure data consistency

This documentation covers the basic operations available in the Reviews module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
