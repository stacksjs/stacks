---
title: Error Handling
description: "Stacks provides a comprehensive error handling system built on ts-error-handling, featuring Result types for functional error handling, custom exceptions, ..."
---
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

In development, an unhandled error renders the debug page: the stack trace,
source snippets around the throw site, request context and recent queries. In
production none of that is shown. The illustrated error page renders instead.

### The Built-in Page

Every production error page is the same split layout. The status, its title and
a one-line message sit on one side; an illustration fills the other. Four scenes
cover every status, grouped by what the page is telling the visitor:

| Scene | Statuses |
| --- | --- |
| A fortress keeping watch over moonlit dunes | 401, 403 |
| A lone camel on an endless ridge at dusk | 404, 405, 410 |
| A domed village at twilight | 408, 429, 502, 503, 504 |
| Footprints trailing off under a midday sun | 400, 409, 422, 500 |

Anything outside that list falls back by status class: a 4xx gets the camel,
everything else gets the footprints.

The page is self-contained. Its CSS is inlined, its illustration is inlined SVG
and it fetches no webfont, so it cannot half-render on the one page guaranteed
to be served while something is already broken. It follows the visitor's
`prefers-color-scheme` and stacks the two halves on narrow screens.

The illustrations were drawn by Steve Schoger for Laravel 5.7 and are used under
Laravel's MIT licence. `public/svgs/` carries standalone copies of the same four
scenes for your own templates to use.

### Custom Error Pages

An HTML file at `resources/views/errors/<status>.html` replaces the built-in
page for that status. `resources/views/errors/error.html` is the catch-all for
every status without a file of its own, and a status-specific file always wins
over it.

Three variables are substituted into the file, HTML-escaped:

| Variable | Example |
| --- | --- |
| `{{status}}` | `404` |
| `{{title}}` | `Not Found` |
| `{{message}}` | `The requested resource could not be found.` |

```html
<!-- resources/views/errors/404.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>{{status}} {{title}}</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      .scene { height: 40vh; background: url("/svgs/404.svg") center / cover; }
      .copy { padding: 2rem; }
    </style>
  </head>
  <body>
    <div class="scene"></div>
    <div class="copy">
      <h1>{{title}}</h1>
      <p>{{message}}</p>
      <a href="/">Go back home</a>
    </div>
  </body>
</html>
```

If no file matches, the built-in page renders. So does an unreadable one, since
a broken custom template must never be the reason an error page fails.

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
- **[Validation](/packages/validation)** - Handling validation errors
