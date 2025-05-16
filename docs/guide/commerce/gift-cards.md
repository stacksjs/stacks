# Gift Cards

The Gift Cards module in the Commerce package provides a robust set of functions to manage and interact with your gift card data. This guide will walk you through the various operations you can perform with gift cards.

## Getting Started

First, import the gift cards functionality from the Commerce package:

```ts
import { giftCards } from '@stacksjs/commerce'
```

## Fetching Gift Cards

The Commerce package provides several methods to fetch gift cards:

### Fetch All Gift Cards

```ts
const allGiftCards = await giftCards.fetchAll()
```

### Fetch a Single Gift Card

```ts
const giftCard = await giftCards.fetchById(1) // Replace 1 with the actual gift card ID
```

### Fetch by Code

```ts
const giftCard = await giftCards.fetchByCode('GIFT123')
```

### Fetch Active Gift Cards

```ts
const activeGiftCards = await giftCards.fetchActive()
```

### Check Gift Card Balance

```ts
const balance = await giftCards.checkBalance('GIFT123')
```

### Fetch Gift Card Statistics

```ts
const stats = await giftCards.fetchStats()
```

### Fetch Total Value

```ts
const totalValue = await giftCards.fetchTotalValue()
```

### Fetch Total Current Balance

```ts
const totalBalance = await giftCards.fetchTotalCurrentBalance()
```

### Compare Active Gift Cards

```ts
const comparison = await giftCards.compareActiveGiftCards(30) // Compare last 30 days
```

### Calculate Gift Card Values

```ts
const values = await giftCards.calculateGiftCardValues(30) // Last 30 days
```

## Managing Gift Cards

### Store a New Gift Card

```ts
const newGiftCard = await giftCards.store({
  code: 'GIFT123',
  initial_balance: 100,
  currency: 'USD',
  expiry_date: '2024-12-31',
  is_active: true,
  status: 'ACTIVE',
  // ... other gift card attributes
})
```

### Update a Gift Card

```ts
const updatedGiftCard = await giftCards.update(1, {
  expiry_date: '2025-12-31',
  status: 'ACTIVE',
})
```

### Update Gift Card Balance

```ts
const updatedGiftCard = await giftCards.updateBalance(1, -50) // Deduct 50 from balance
```

### Delete Gift Cards

Single gift card deletion:
```ts
await giftCards.destroy(1) // Replace 1 with the gift card ID to delete
```

Bulk deletion:
```ts
await giftCards.bulkDestroy([1, 2, 3]) // Array of gift card IDs to delete
```

Delete expired gift cards:
```ts
await giftCards.destroyExpired()
```

Deactivate a gift card:
```ts
await giftCards.deactivate(1) // Replace 1 with the gift card ID to deactivate
```

## API Endpoints

The Gift Cards module provides RESTful API endpoints for managing gift cards. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/gift-cards              # List all gift cards
POST   /commerce/gift-cards              # Create a new gift card
GET    /commerce/gift-cards/{id}         # Get a specific gift card
PATCH  /commerce/gift-cards/{id}         # Update a gift card
DELETE /commerce/gift-cards/{id}         # Delete a gift card
GET    /commerce/gift-cards/code/{code}  # Get a gift card by code
GET    /commerce/gift-cards/active       # Get active gift cards
GET    /commerce/gift-cards/balance/{code} # Check gift card balance
GET    /commerce/gift-cards/stats        # Get gift card statistics
GET    /commerce/gift-cards/value        # Get total gift card value
GET    /commerce/gift-cards/balance      # Get total current balance
```

### Example Usage

```ts
// List all gift cards
const response = await fetch('/commerce/gift-cards')
const giftCards = await response.json()

// Create a new gift card
const response = await fetch('/commerce/gift-cards', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    code: 'GIFT123',
    initial_balance: 100,
    currency: 'USD',
    expiry_date: '2024-12-31',
    is_active: true,
    status: 'ACTIVE',
  }),
})
const newGiftCard = await response.json()

// Get a specific gift card
const response = await fetch('/commerce/gift-cards/1')
const giftCard = await response.json()

// Update a gift card
const response = await fetch('/commerce/gift-cards/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    expiry_date: '2025-12-31',
    status: 'ACTIVE',
  }),
})
const updatedGiftCard = await response.json()

// Delete a gift card
await fetch('/commerce/gift-cards/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the gift card data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "code": "GIFT123",
  "initial_balance": 100,
  "current_balance": 100,
  "currency": "USD",
  "expiry_date": "2024-12-31T00:00:00.000Z",
  "is_active": true,
  "status": "ACTIVE",
  "last_used_date": null,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Gift Cards module includes built-in error handling for common scenarios:

- Duplicate gift card codes will throw an error with the message "A gift card with this code already exists"
- Attempting to update or delete a non-existent gift card will throw an appropriate error
- Attempting to use an inactive gift card will throw an error
- Attempting to use an expired gift card will throw an error
- Attempting to deduct more than the available balance will throw an error
- All database operations are wrapped in try-catch blocks to provide meaningful error messages

This documentation covers the basic operations available in the Gift Cards module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
