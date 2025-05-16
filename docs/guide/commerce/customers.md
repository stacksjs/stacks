# Customers

The Customers module in the Commerce package provides a robust set of functions to manage and interact with your customer data. This guide will walk you through the various operations you can perform with customers.

## Getting Started

First, import the customers functionality from the Commerce package:

```ts
import { customers } from '@stacksjs/commerce'
```

## Fetching Customers

The Commerce package provides several methods to fetch customers:

### Fetch All Customers

```ts
const allCustomers = await customers.fetchAll()
```

### Fetch a Single Customer

```ts
const customer = await customers.fetchById(1) // Replace 1 with the actual customer ID
```

## Managing Customers

### Store a New Customer

```ts
const newCustomer = await customers.store({
  // customer data
})
```

### Update a Customer

```ts
const updatedCustomer = await customers.update(1, {
  // updated customer data
})
```

### Delete Customers

Single customer deletion:
```ts
await customers.destroy(1) // Replace 1 with the customer ID to delete
```

Bulk deletion:
```ts
await customers.bulkDestroy([1, 2, 3]) // Array of customer IDs to delete
```

## API Endpoints

The Customers module provides RESTful API endpoints for managing customers. All endpoints are prefixed with `/commerce`.

```
GET    /commerce/customers              # List all customers
POST   /commerce/customers              # Create a new customer
GET    /commerce/customers/{id}         # Get a specific customer
PATCH  /commerce/customers/{id}         # Update a customer
DELETE /commerce/customers/{id}         # Delete a customer
```

### Example Usage

```ts
// List all customers
const response = await fetch('/commerce/customers')
const customers = await response.json()

// Create a new customer
const response = await fetch('/commerce/customers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    // customer data
  }),
})
const newCustomer = await response.json()

// Get a specific customer
const response = await fetch('/commerce/customers/1')
const customer = await response.json()

// Update a customer
const response = await fetch('/commerce/customers/1', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    // updated customer data
  }),
})
const updatedCustomer = await response.json()

// Delete a customer
await fetch('/commerce/customers/1', {
  method: 'DELETE',
})
```

### Response Format

A successful response includes the customer data with all its attributes:

```json
{
  "id": 1,
  "email": "customer@example.com",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

## Error Handling

The Customers module includes built-in error handling for common scenarios:

- Duplicate email addresses will throw an error with the message "A customer with this email already exists"
- Attempting to update or delete a non-existent customer will throw an appropriate error
- All database operations are wrapped in try-catch blocks to provide meaningful error messages

This documentation covers the basic operations available in the Customers module. Each function is type-safe and returns properly typed responses, making it easy to work with in TypeScript environments.