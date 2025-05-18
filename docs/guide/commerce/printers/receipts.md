# Receipts

The Receipts module in the Commerce package provides a comprehensive set of functions to manage receipt printing logs and analytics. This module helps you track print jobs, monitor success rates, and analyze printing performance.

## Getting Started

First, import the receipts functionality from the Commerce package:

```ts
import { receipts } from '@stacksjs/commerce'
```

## Fetching Receipts

The Commerce package provides several methods to fetch receipt information:

### Basic Fetching

```ts
// Fetch all receipts
const allReceipts = await receipts.fetchAll()

// Fetch a single receipt
const receipt = await receipts.fetchById(1)
```

### Print Job Statistics

```ts
const startDate = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
const endDate = Date.now()

// Get comprehensive print job stats
const jobStats = await receipts.fetchPrintJobStats(startDate, endDate)
// Returns:
// {
//   total: number,
//   success: number,
//   failed: number,
//   warning: number,
//   averageSize: number,
//   averagePages: number,
//   averageDuration: number
// }

// Get success rate statistics
const successStats = await receipts.fetchSuccessRate(startDate, endDate)
// Returns:
// {
//   successRate: number,
//   total: number,
//   success: number,
//   failed: number,
//   warning: number
// }
```

### Page Statistics

```ts
// Get page statistics
const pageStats = await receipts.fetchPageStats(startDate, endDate)
// Returns:
// {
//   totalPages: number,
//   averagePagesPerReceipt: number,
//   totalReceipts: number
// }
```

### Print Time Analytics

```ts
// Get print time statistics
const timeStats = await receipts.fetchPrintTimeStats(startDate, endDate)
// Returns:
// {
//   averageDuration: number,
//   minDuration: number,
//   maxDuration: number,
//   totalJobs: number
// }

// Get prints per hour analysis
const hourlyStats = await receipts.fetchPrintsPerHour(startDate, endDate)
// Returns:
// {
//   totalPrints: number,
//   totalHours: number,
//   printsPerHour: number,
//   hourlyBreakdown: Array<{ hour: number, count: number }>
// }
```

## Managing Receipts

### Store a New Receipt

```ts
const newReceipt = await receipts.store({
  print_device_id: 1,
  order_id: 123,
  status: 'success',
  size: 1024,
  pages: 1,
  duration: 500,
  timestamp: Date.now(),
})
```

### Store Multiple Receipts

```ts
const newReceipts = await receipts.bulkStore([
  {
    print_device_id: 1,
    order_id: 123,
    status: 'success',
    size: 1024,
    pages: 1,
  },
  {
    print_device_id: 2,
    order_id: 124,
    status: 'success',
    size: 2048,
    pages: 2,
  },
])
```

### Update a Receipt

```ts
const updatedReceipt = await receipts.update(1, {
  status: 'success',
  size: 2048,
  pages: 2,
})
```

### Update Receipt Status

```ts
const updatedStatus = await receipts.updateStatus(1, 'success')
```

### Update Print Job Information

```ts
const updatedJob = await receipts.updatePrintJob(1, 2048, 2, 750)
```

### Delete Receipts

Single receipt deletion:
```ts
const deleted = await receipts.destroy(1) // Returns true if successful
```

Bulk deletion:
```ts
const deletedCount = await receipts.bulkDestroy([1, 2, 3]) // Returns number of receipts deleted
```

## API Endpoints

The Receipts module provides RESTful API endpoints for managing receipts. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/printers/receipts              # List all receipts
POST   /commerce/printers/receipts              # Create a new receipt
POST   /commerce/printers/receipts/bulk         # Create multiple receipts
GET    /commerce/printers/receipts/{id}         # Get a specific receipt
PATCH  /commerce/printers/receipts/{id}         # Update a receipt
PATCH  /commerce/printers/receipts/{id}/status  # Update receipt status
PATCH  /commerce/printers/receipts/{id}/job     # Update print job information
DELETE /commerce/printers/receipts/{id}         # Delete a receipt
DELETE /commerce/printers/receipts/bulk         # Delete multiple receipts
GET    /commerce/printers/receipts/stats        # Get print statistics
```

### Example Usage

```ts
// List all receipts
const response = await fetch('/commerce/printers/receipts')
const receipts = await response.json()

// Create a new receipt
const response = await fetch('/commerce/printers/receipts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    print_device_id: 1,
    order_id: 123,
    status: 'success',
    size: 1024,
    pages: 1,
  }),
})
const newReceipt = await response.json()

// Update receipt status
const response = await fetch('/commerce/printers/receipts/1/status', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'success',
  }),
})
const updatedStatus = await response.json()
```

### Response Format

A successful response includes the receipt data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "print_device_id": 1,
  "order_id": 123,
  "status": "success",
  "size": 1024,
  "pages": 1,
  "duration": 500,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Receipts module includes built-in error handling for common scenarios:

- Invalid receipt IDs will throw appropriate errors
- Missing required fields during creation will throw validation errors
- All database operations are wrapped in try-catch blocks for proper error handling
- Bulk operations are handled atomically to ensure data consistency
- Status updates are validated against allowed values ('success', 'failed', 'warning')
- Size and page count validations ensure non-negative numbers
- Duration validations ensure proper time values
- Timestamp validations ensure proper date format

Example error handling in your code:

```ts
try {
  const receipt = await receipts.store({
    print_device_id: 1,
    order_id: 123,
    status: 'success',
    size: 1024,
    pages: 1,
  })
} catch (error) {
  console.error('Failed to create receipt:', error.message)
}
```

This documentation covers the basic operations available in the Receipts module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
