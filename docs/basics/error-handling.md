# Error Handling

Stacks provides a comprehensive error handling system built on [ts-error-handling](https://github.com/stacksjs/ts-error-handling), featuring Result types for functional error handling, custom exceptions, and error reporting.

## Overview

The Stacks error handling system helps you:

- **Handle errors gracefully** - Without crashing your application
- **Use Result types** - Explicit, type-safe error handling
- **Create custom exceptions** - Domain-specific error classes
- **Report errors** - Send errors to monitoring services

## Quick Start

### Basic Error Handling

```typescript
import { handleError } from '@stacksjs/error-handling'

try {
  await riskyOperation()
} catch (error) {
  handleError(error)
}
```

### With Options

```typescript
handleError(error, {
  shouldExit: false,  // Don't exit process
  silent: false,      // Log to console
  message: 'Custom error context',
})
```

## Result Types

Use Result types for functional error handling, avoiding try-catch blocks.

### Basic Usage

```typescript
import { err, ok, type Result } from '@stacksjs/error-handling'

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Cannot divide by zero')
  }
  return ok(a / b)
}

// Usage
const result = divide(10, 2)

if (result.isOk()) {
  console.log('Result:', result.value)  // 5
} else {
  console.log('Error:', result.error)
}
```

### Async Results

```typescript
import { err, ok, type Result } from '@stacksjs/error-handling'

async function fetchUser(id: number): Promise<Result<User, Error>> {
  try {
    const response = await fetch(`/api/users/${id}`)
    if (!response.ok) {
      return err(new Error(`HTTP ${response.status}`))
    }
    const user = await response.json()
    return ok(user)
  } catch (error) {
    return err(error as Error)
  }
}

// Usage
const result = await fetchUser(1)
if (result.isOk()) {
  console.log('User:', result.value.name)
}
```

### Chaining Results

```typescript
function validateEmail(email: string): Result<string, string> {
  if (!email.includes('@')) {
    return err('Invalid email format')
  }
  return ok(email.toLowerCase())
}

function validatePassword(password: string): Result<string, string> {
  if (password.length < 8) {
    return err('Password must be at least 8 characters')
  }
  return ok(password)
}

// Chain validations
const result = validateEmail(email)
  .andThen(() => validatePassword(password))
  .map(data => ({ ...data, validated: true }))
```

## Custom Exceptions

### Creating Custom Exceptions

```typescript
// app/Exceptions/ValidationException.ts
export class ValidationException extends Error {
  public readonly errors: Record<string, string[]>

  constructor(errors: Record<string, string[]>) {
    const message = Object.values(errors).flat().join(', ')
    super(message)
    this.name = 'ValidationException'
    this.errors = errors
  }

  static fromField(field: string, message: string): ValidationException {
    return new ValidationException({ [field]: [message] })
  }
}
```

### HTTP Exceptions

```typescript
// app/Exceptions/HttpException.ts
export class HttpException extends Error {
  public readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'HttpException'
    this.statusCode = statusCode
  }

  static badRequest(message = 'Bad Request') {
    return new HttpException(400, message)
  }

  static unauthorized(message = 'Unauthorized') {
    return new HttpException(401, message)
  }

  static notFound(message = 'Not Found') {
    return new HttpException(404, message)
  }

  static serverError(message = 'Internal Server Error') {
    return new HttpException(500, message)
  }
}
```

### Using Custom Exceptions

```typescript
import { ValidationException } from '@/Exceptions/ValidationException'
import { HttpException } from '@/Exceptions/HttpException'

async function createUser(data: CreateUserInput) {
  // Validation
  const errors: Record<string, string[]> = {}

  if (!data.email) {
    errors.email = ['Email is required']
  }
  if (!data.password || data.password.length < 8) {
    errors.password = ['Password must be at least 8 characters']
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationException(errors)
  }

  // Check for duplicate
  const existing = await User.findByEmail(data.email)
  if (existing) {
    throw HttpException.badRequest('Email already exists')
  }

  return User.create(data)
}
```

## Error Pages

### Custom Error Pages

Create custom error pages in `resources/layouts/`:

```html
<!-- resources/layouts/404.stx -->
<template>
  <div class="error-page">
    <h1>404</h1>
    <h2>Page Not Found</h2>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/">Go back home</a>
  </div>
</template>
```

```html
<!-- resources/layouts/500.stx -->
<template>
  <div class="error-page">
    <h1>500</h1>
    <h2>Something went wrong</h2>
    <p>We're sorry, but something went wrong on our end.</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
</template>
```

## Global Error Handler

### HTTP Error Handler

```typescript
// app/Middleware/ErrorHandler.ts
import { HttpException } from '@/Exceptions/HttpException'
import { ValidationException } from '@/Exceptions/ValidationException'
import { handleError } from '@stacksjs/error-handling'

export async function errorHandler(error: Error, request: Request) {
  // Log the error
  handleError(error, { shouldExit: false })

  // HTTP exceptions
  if (error instanceof HttpException) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }

  // Validation exceptions
  if (error instanceof ValidationException) {
    return Response.json(
      { error: 'Validation failed', errors: error.errors },
      { status: 422 }
    )
  }

  // Generic server error
  return Response.json(
    { error: 'Internal Server Error' },
    { status: 500 }
  )
}
```

## Error Reporting

### Logging Errors

```typescript
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'

try {
  await riskyOperation()
} catch (error) {
  // Log with context
  log.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    userId: currentUser?.id,
  })

  // Handle (may exit process)
  handleError(error, { shouldExit: false })
}
```

### External Error Reporting

```typescript
// app/Services/ErrorReporter.ts
class ErrorReporter {
  static async report(error: Error, context?: Record<string, unknown>) {
    // Send to Sentry, Bugsnag, etc.
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, { extra: context })
    }

    // Send to Slack
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({
          text: `Error: ${error.message}`,
          attachments: [{ color: 'danger', text: error.stack }],
        }),
      })
    }
  }
}
```

## Best Practices

### Use Result Types for Expected Failures

```typescript
// Good: Explicit error handling
async function findUser(id: number): Promise<Result<User, string>> {
  const user = await db.users.find(id)
  if (!user) {
    return err('User not found')
  }
  return ok(user)
}
```

### Use Exceptions for Unexpected Failures

```typescript
// Good: Exception for unexpected error
async function processPayment(order: Order) {
  const gateway = getPaymentGateway()
  if (!gateway) {
    throw new Error('Payment gateway not configured')
  }
  return gateway.charge(order)
}
```

### Always Add Context

```typescript
try {
  await processOrder(orderId)
} catch (error) {
  handleError(error, {
    message: `Failed to process order ${orderId}`,
  })
}
```

## Related Resources

### Underlying Libraries

- **[ts-error-handling](https://github.com/stacksjs/ts-error-handling)** - Result types and error utilities

### Related Stacks Packages

- **[Logging Package](/packages/logging)** - Error logging
- **[Validation Package](/packages/validation)** - Input validation errors

### Related Guides

- **[Logging](/basics/logging)** - Logging errors
- **[Validation](/guide/validation)** - Handling validation errors
