# Error Handling Package

A comprehensive error handling system providing Result types for type-safe error handling, HTTP exceptions, model exceptions, and structured error management.

## Installation

```bash
bun add @stacksjs/error-handling
```

## Basic Usage

```typescript
import { ok, err, Result, handleError } from '@stacksjs/error-handling'

// Return success
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) {
    return err(new Error('Division by zero'))
  }
  return ok(a / b)
}

// Handle result
const result = divide(10, 2)
if (result.isOk) {
  console.log('Result:', result.value)
} else {
  console.log('Error:', result.error.message)
}
```

## Result Types

### Creating Results

```typescript
import { ok, err, Result } from '@stacksjs/error-handling'

// Success result
const success: Result<number, Error> = ok(42)

// Error result
const failure: Result<number, Error> = err(new Error('Something went wrong'))

// Type inference
function fetchUser(id: number): Result<User, Error> {
  const user = database.find(id)
  if (!user) {
    return err(new Error('User not found'))
  }
  return ok(user)
}
```

### Checking Results

```typescript
const result = fetchUser(1)

// Using isOk/isErr
if (result.isOk) {
  console.log('User:', result.value)
} else {
  console.log('Error:', result.error.message)
}

// Using match pattern
result.match(
  (user) => console.log('Found user:', user.name),
  (error) => console.log('Error:', error.message)
)
```

### Unwrapping Results

```typescript
// Unwrap (throws if error)
const value = result.unwrap() // Throws if isErr

// Unwrap with default
const value = result.unwrapOr(defaultUser)

// Unwrap or else (lazy default)
const value = result.unwrapOrElse(() => createDefaultUser())

// Expect (unwrap with custom error message)
const value = result.expect('User should exist')
```

### Transforming Results

```typescript
// Map success value
const nameResult = userResult.map(user => user.name)

// Map error
const friendlyError = userResult.mapErr(err =>
  new Error(`User lookup failed: ${err.message}`)
)

// FlatMap (andThen)
const profileResult = userResult.andThen(user =>
  fetchProfile(user.id)
)

// Chain operations
const result = fetchUser(1)
  .andThen(user => fetchProfile(user.id))
  .map(profile => profile.avatar)
  .mapErr(err => new Error(`Failed: ${err.message}`))
```

## Async Result

### Promise Integration

```typescript
import { fromPromise, ResultAsync } from '@stacksjs/error-handling'

// Convert promise to Result
const result = await fromPromise(
  fetch('/api/user/1'),
  (error) => new Error(`Fetch failed: ${error}`)
)

if (result.isOk) {
  const response = result.value
}
```

### Async Operations

```typescript
// Chain async operations
const result = await fromPromise(fetch('/api/user/1'))
  .andThen(response => fromPromise(response.json()))
  .map(data => data.user)

// Multiple async operations
const [user, posts] = await Promise.all([
  fromPromise(fetchUser(1)),
  fromPromise(fetchPosts(1))
])
```

## HTTP Errors

### HTTP Error Class

```typescript
import { HttpError } from '@stacksjs/error-handling'

// Throw HTTP error
throw new HttpError(404, 'User not found')
throw new HttpError(401, 'Unauthorized')
throw new HttpError(403, 'Forbidden')
throw new HttpError(500, 'Internal server error')

// With additional data
throw new HttpError(422, 'Validation failed', {
  errors: {
    email: ['Invalid email format'],
    password: ['Password too short']
  }
})
```

### Common HTTP Errors

```typescript
// 400 Bad Request
throw new HttpError(400, 'Invalid request body')

// 401 Unauthorized
throw new HttpError(401, 'Authentication required')

// 403 Forbidden
throw new HttpError(403, 'Insufficient permissions')

// 404 Not Found
throw new HttpError(404, 'Resource not found')

// 422 Unprocessable Entity
throw new HttpError(422, 'Validation failed', { errors })

// 429 Too Many Requests
throw new HttpError(429, 'Rate limit exceeded')

// 500 Internal Server Error
throw new HttpError(500, 'Something went wrong')

// 503 Service Unavailable
throw new HttpError(503, 'Service temporarily unavailable')
```

### Handling HTTP Errors

```typescript
try {
  await performAction()
} catch (error) {
  if (error instanceof HttpError) {
    return Response.json(
      { error: error.message, ...error.data },
      { status: error.statusCode }
    )
  }
  throw error
}
```

## Model Errors

### Model Not Found

```typescript
import { ModelNotFoundException } from '@stacksjs/error-handling'

async function getUser(id: number) {
  const user = await User.find(id)
  if (!user) {
    throw new ModelNotFoundException('User', id)
  }
  return user
}

// Handling
try {
  const user = await getUser(999)
} catch (error) {
  if (error instanceof ModelNotFoundException) {
    console.log(`${error.model} with ID ${error.id} not found`)
    // "User with ID 999 not found"
  }
}
```

### Validation Errors

```typescript
import { ValidationException } from '@stacksjs/error-handling'

function validateUser(data: any) {
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
}
```

## Error Handler

### Basic Error Handling

```typescript
import { handleError } from '@stacksjs/error-handling'

try {
  await riskyOperation()
} catch (error) {
  handleError(error)
  // Logs error and continues
}

// With options
handleError(error, {
  shouldExit: true,  // Exit process
  silent: false,     // Show in console
  message: 'Custom error context'
})
```

### Error Processing

```typescript
import { handleError } from '@stacksjs/error-handling'

// Process and return formatted error
const processed = handleError(error)

// Returns Error object with proper message
console.log(processed.message)
console.log(processed.stack)
```

## Utility Functions

### Creating Errors

```typescript
import { handleError, err, ok } from '@stacksjs/error-handling'

// From string
const error = handleError('Something went wrong')

// From object
const error = handleError({ code: 'ERR_001', message: 'Failed' })

// From Error
const error = handleError(new Error('Original error'))

// From unknown
function processError(unknown: unknown) {
  const error = handleError(unknown)
  return error.message
}
```

### Safe Execution

```typescript
// Execute function and catch errors as Result
function safeExecute<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn())
  } catch (error) {
    return err(handleError(error))
  }
}

const result = safeExecute(() => JSON.parse(data))
```

## Patterns

### Railway-Oriented Programming

```typescript
// Chain operations that can fail
function processOrder(orderId: string): Result<Receipt, Error> {
  return findOrder(orderId)
    .andThen(validateOrder)
    .andThen(calculateTotal)
    .andThen(processPayment)
    .andThen(generateReceipt)
}

// Each function returns Result<T, Error>
function findOrder(id: string): Result<Order, Error> {
  const order = orders.get(id)
  return order ? ok(order) : err(new Error('Order not found'))
}

function validateOrder(order: Order): Result<Order, Error> {
  if (order.items.length === 0) {
    return err(new Error('Order has no items'))
  }
  return ok(order)
}
```

### Error Accumulation

```typescript
// Collect multiple errors
function validateForm(data: FormData): Result<FormData, string[]> {
  const errors: string[] = []

  if (!data.name) errors.push('Name is required')
  if (!data.email) errors.push('Email is required')
  if (!data.password) errors.push('Password is required')

  return errors.length > 0 ? err(errors) : ok(data)
}
```

### Fallback Chain

```typescript
// Try multiple sources
async function fetchData(): Promise<Result<Data, Error>> {
  const cacheResult = await fromPromise(cache.get('data'))
  if (cacheResult.isOk) return cacheResult

  const dbResult = await fromPromise(database.query())
  if (dbResult.isOk) {
    await cache.set('data', dbResult.value)
    return dbResult
  }

  return err(new Error('All data sources failed'))
}
```

## Edge Cases

### Handling Unknown Errors

```typescript
try {
  await externalApi.call()
} catch (error) {
  // Error could be anything
  const processed = handleError(error)

  if (error instanceof TypeError) {
    // Handle type error
  } else if (typeof error === 'string') {
    // Handle string error
  } else if (error instanceof Error) {
    // Handle Error object
  } else {
    // Handle unknown
    log.error('Unknown error type:', error)
  }
}
```

### Nested Errors

```typescript
// Preserve error chain
function wrapError(original: Error, context: string): Error {
  const wrapped = new Error(`${context}: ${original.message}`)
  wrapped.cause = original
  return wrapped
}

try {
  await database.query()
} catch (error) {
  throw wrapError(error, 'Database query failed')
}
```

### Timeout Handling

```typescript
import { fromPromise } from '@stacksjs/error-handling'

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)

  const result = await fromPromise(
    fetch(url, { signal: controller.signal }),
    (error) => {
      if (error.name === 'AbortError') {
        return new Error('Request timed out')
      }
      return error
    }
  )

  clearTimeout(timeout)
  return result
}
```

### Retrying Operations

```typescript
async function withRetry<T>(
  fn: () => Promise<Result<T, Error>>,
  maxAttempts: number = 3
): Promise<Result<T, Error>> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn()
    if (result.isOk) return result

    lastError = result.error
    await sleep(attempt * 1000) // Exponential backoff
  }

  return err(new Error(`Failed after ${maxAttempts} attempts: ${lastError.message}`))
}

// Usage
const result = await withRetry(() => fetchUser(id))
```

## TypeScript Integration

### Type-Safe Error Handling

```typescript
// Define specific error types
type ApiError =
  | { type: 'network'; message: string }
  | { type: 'validation'; errors: string[] }
  | { type: 'auth'; message: string }

function handleApiError(error: ApiError) {
  switch (error.type) {
    case 'network':
      return `Network error: ${error.message}`
    case 'validation':
      return `Validation errors: ${error.errors.join(', ')}`
    case 'auth':
      return `Authentication error: ${error.message}`
  }
}
```

### Generic Result Types

```typescript
// Generic function returning Result
async function fetchResource<T>(url: string): Promise<Result<T, Error>> {
  const response = await fromPromise(fetch(url))
  if (response.isErr) return response as unknown as Result<T, Error>

  const data = await fromPromise(response.value.json())
  return data as Result<T, Error>
}

// Usage with type inference
const result = await fetchResource<User>('/api/user/1')
if (result.isOk) {
  const user: User = result.value
}
```

## API Reference

### Result Type

| Property/Method | Description |
|-----------------|-------------|
| `isOk` | True if success |
| `isErr` | True if error |
| `value` | Success value (if isOk) |
| `error` | Error value (if isErr) |
| `unwrap()` | Get value or throw |
| `unwrapOr(default)` | Get value or default |
| `unwrapOrElse(fn)` | Get value or compute |
| `expect(msg)` | Get value or throw with message |
| `map(fn)` | Transform value |
| `mapErr(fn)` | Transform error |
| `andThen(fn)` | Chain Result operations |
| `match(ok, err)` | Pattern match |

### Factory Functions

| Function | Description |
|----------|-------------|
| `ok(value)` | Create success Result |
| `err(error)` | Create error Result |
| `fromPromise(promise, errFn?)` | Convert Promise to Result |

### Error Classes

| Class | Description |
|-------|-------------|
| `HttpError` | HTTP status error |
| `ModelNotFoundException` | Model not found |
| `ValidationException` | Validation errors |

### Utility Functions

| Function | Description |
|----------|-------------|
| `handleError(err, opts?)` | Process any error |
