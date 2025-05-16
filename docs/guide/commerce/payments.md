# Payments

The Payments module in the Commerce package provides a robust set of functions to manage and interact with your payment data. This guide will walk you through the various operations you can perform with payments.

## Getting Started

First, import the payments functionality from the Commerce package:

```ts
import { payments } from '@stacksjs/commerce'
```

## Fetching Payments

The Commerce package provides several methods to fetch payments:

### Fetch All Payments

```ts
const allPayments = await payments.fetchAll()
```

### Fetch a Single Payment

```ts
const payment = await payments.fetchById(1) // Replace 1 with the actual payment ID
```

### Fetch Payment Statistics

```ts
const stats = await payments.fetchPaymentStats(30) // Last 30 days
```

### Fetch Payment Statistics by Method

```ts
const methodStats = await payments.fetchPaymentStatsByMethod(30) // Last 30 days
```

### Fetch Monthly Payment Trends

```ts
const trends = await payments.fetchMonthlyPaymentTrends() // Last 12 months
```

## Managing Payments

### Store a New Payment

```ts
const newPayment = await payments.store({
  amount: 99.99,
  currency: 'USD',
  method: 'credit_card',
  status: 'PENDING',
  transaction_id: 'txn_123',
  // ... other payment attributes
})
```

### Delete Payments

Single payment deletion:
```ts
await payments.destroy(1) // Replace 1 with the payment ID to delete
```

Bulk deletion:
```ts
await payments.bulkDestroy([1, 2, 3]) // Array of payment IDs to delete
```

## API Endpoints

The Payments module provides RESTful API endpoints for managing payments. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/payments              # List all payments
POST   /commerce/payments              # Create a new payment
GET    /commerce/payments/{id}         # Get a specific payment
DELETE /commerce/payments/{id}         # Delete a payment
GET    /commerce/payments/stats        # Get payment statistics
GET    /commerce/payments/methods      # Get payment statistics by method
GET    /commerce/payments/trends       # Get monthly payment trends
```

### Example Usage

```ts
// List all payments
const response = await fetch('/commerce/payments')
const payments = await response.json()

// Create a new payment
const response = await fetch('/commerce/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: 99.99,
    currency: 'USD',
    method: 'credit_card',
    status: 'PENDING',
    transaction_id: 'txn_123',
  }),
})
const newPayment = await response.json()

// Get a specific payment
const response = await fetch('/commerce/payments/1')
const payment = await response.json()

// Delete a payment
await fetch('/commerce/payments/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the payment data with all its attributes:

```json
{
  "id": 1,
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 99.99,
  "currency": "USD",
  "method": "credit_card",
  "status": "PENDING",
  "transaction_id": "txn_123",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Statistics Response Format

The payment statistics response includes comprehensive data about payment performance:

```json
{
  "total_transactions": 100,
  "total_revenue": 9999.99,
  "average_transaction": 99.99,
  "successful_rate": 95.5,
  "comparison": {
    "transactions": {
      "difference": 10,
      "percentage": 11.11,
      "is_increase": true
    },
    "revenue": {
      "difference": 999.99,
      "percentage": 11.11,
      "is_increase": true
    },
    "average": {
      "difference": 0.99,
      "percentage": 1.0,
      "is_increase": true
    }
  }
}
```

### Method Statistics Response Format

The payment method statistics response includes detailed breakdown by payment method:

```json
{
  "credit_card": {
    "count": 75,
    "revenue": 7499.25,
    "percentage_of_total": 75
  },
  "paypal": {
    "count": 25,
    "revenue": 2500.75,
    "percentage_of_total": 25
  }
}
```

### Monthly Trends Response Format

The monthly payment trends response includes historical data:

```json
[
  {
    "month": "Jan",
    "year": 2024,
    "transactions": 100,
    "revenue": 9999.99,
    "average": 99.99
  }
]
```

## Error Handling

The Payments module includes built-in error handling for common scenarios:

- Duplicate transaction IDs will throw an error with the message "A payment with this transaction ID already exists"
- Insufficient funds will throw an error with the message "Insufficient funds for this payment"
- Attempting to delete a non-existent payment will throw an appropriate error
- All database operations are wrapped in try-catch blocks to provide meaningful error messages

This documentation covers the basic operations available in the Payments module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.
