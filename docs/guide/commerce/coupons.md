# Coupons

The Coupons module in the Commerce package provides a robust set of functions to manage and interact with your coupon data. This guide will walk you through the various operations you can perform with coupons.

## Getting Started

First, import the coupons functionality from the Commerce package:

```ts
import { coupons } from '@stacksjs/commerce'
```

## Fetching Coupons

The Commerce package provides several methods to fetch coupons:

### Fetch All Coupons

```ts
const allCoupons = await coupons.fetchAll()
```

### Fetch a Single Coupon

```ts
const coupon = await coupons.fetchById(1) // Replace 1 with the actual coupon ID
```

### Fetch by Code

```ts
const coupon = await coupons.fetchByCode('SUMMER2024')
```

### Fetch Active Coupons

```ts
const activeCoupons = await coupons.fetchActive()
```

### Fetch Coupon Statistics

```ts
const stats = await coupons.fetchStats()
```

### Fetch Coupon Counts

```ts
const counts = await coupons.fetchCouponCounts()
```

### Fetch Coupon Counts by Type

```ts
const countsByType = await coupons.fetchCouponCountsByType()
```

### Fetch Redemption Statistics

```ts
const redemptionStats = await coupons.fetchRedemptionStats()
```

### Fetch Top Redeemed Coupons

```ts
const topCoupons = await coupons.fetchTopRedeemedCoupons(5) // Limit to top 5
```

### Fetch Redemption Trend

```ts
const trend = await coupons.fetchRedemptionTrend(30) // Last 30 days
```

### Fetch Conversion Rate

```ts
const conversion = await coupons.fetchConversionRate()
```

### Fetch Month-over-Month Change

```ts
const momChange = await coupons.getActiveCouponsMoMChange()
```

## Managing Coupons

### Store a New Coupon

```ts
const newCoupon = await coupons.store({
  code: 'SUMMER2024',
  discount_type: 'percentage',
  discount_value: 20,
  start_date: '2024-06-01',
  end_date: '2024-08-31',
  is_active: true,
  // ... other coupon attributes
})
```

### Update a Coupon

```ts
const updatedCoupon = await coupons.update(1, {
  discount_value: 25,
  end_date: '2024-09-30',
})
```

### Delete Coupons

Single coupon deletion:
```ts
await coupons.deleteCoupon(1) // Replace 1 with the coupon ID to delete
```

Bulk deletion:
```ts
await coupons.deleteCoupons([1, 2, 3]) // Array of coupon IDs to delete
```

Delete expired coupons:
```ts
await coupons.deleteExpiredCoupons()
```

## API Endpoints

The Coupons module provides RESTful API endpoints for managing coupons. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/coupons              # List all coupons
POST   /commerce/coupons              # Create a new coupon
GET    /commerce/coupons/{id}         # Get a specific coupon
PATCH  /commerce/coupons/{id}         # Update a coupon
DELETE /commerce/coupons/{id}         # Delete a coupon
GET    /commerce/coupons/code/{code}  # Get a coupon by code
GET    /commerce/coupons/active       # Get active coupons
GET    /commerce/coupons/stats        # Get coupon statistics
GET    /commerce/coupons/counts       # Get coupon counts
GET    /commerce/coupons/redemption   # Get redemption statistics
GET    /commerce/coupons/trend        # Get redemption trend
```

### Example Usage

```ts
// List all coupons
const response = await fetch('/commerce/coupons')
const coupons = await response.json()

// Create a new coupon
const response = await fetch('/commerce/coupons', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    code: 'SUMMER2024',
    discount_type: 'percentage',
    discount_value: 20,
    start_date: '2024-06-01',
    end_date: '2024-08-31',
    is_active: true,
  }),
})
const newCoupon = await response.json()

// Get a specific coupon
const response = await fetch('/commerce/coupons/1')
const coupon = await response.json()

// Update a coupon
const response = await fetch('/commerce/coupons/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    discount_value: 25,
    end_date: '2024-09-30',
  }),
})
const updatedCoupon = await response.json()

// Delete a coupon
await fetch('/commerce/coupons/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the coupon data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "code": "SUMMER2024",
  "discount_type": "percentage",
  "discount_value": 20,
  "start_date": "2024-06-01T00:00:00.000Z",
  "end_date": "2024-08-31T00:00:00.000Z",
  "is_active": true,
  "usage_count": 0,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Coupons module includes built-in error handling for common scenarios:

- Duplicate coupon codes will throw an error with the message "A coupon with this code already exists"
- Attempting to update or delete a non-existent coupon will throw an appropriate error
- All database operations are wrapped in try-catch blocks to provide meaningful error messages

This documentation covers the basic operations available in the Coupons module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
