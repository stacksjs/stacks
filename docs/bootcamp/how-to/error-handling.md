# Error Handling

This guide covers error handling patterns, debugging techniques, and best practices for managing errors in your Stacks application.

## Getting Started

Import error handling utilities:

```ts
import { HttpError } from '@stacksjs/error-handling'
```

## HTTP Errors

### Creating HTTP Errors

```ts
import { HttpError } from '@stacksjs/error-handling'

// Not Found (404)
throw new HttpError(404, 'Resource not found')

// Bad Request (400)
throw new HttpError(400, 'Invalid input data')

// Unauthorized (401)
throw new HttpError(401, 'Authentication required')

// Forbidden (403)
throw new HttpError(403, 'You do not have permission to access this resource')

// Internal Server Error (500)
throw new HttpError(500, 'An unexpected error occurred')
```

### Custom Error Classes

```ts
// errors/ValidationError.ts
export class ValidationError extends Error {
  public statusCode = 422
  public errors: Record<string, string[]>

  constructor(errors: Record<string, string[]>) {
    super('Validation failed')
    this.name = 'ValidationError'
    this.errors = errors
  }

  toJSON() {
    return {
      message: this.message,
      errors: this.errors,
    }
  }
}

// errors/NotFoundError.ts
export class NotFoundError extends Error {
  public statusCode = 404
  public resource: string

  constructor(resource: string, id?: string | number) {
    super(id ? `${resource} with ID ${id} not found` : `${resource} not found`)
    this.name = 'NotFoundError'
    this.resource = resource
  }
}

// errors/AuthenticationError.ts
export class AuthenticationError extends Error {
  public statusCode = 401

  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

// errors/AuthorizationError.ts
export class AuthorizationError extends Error {
  public statusCode = 403

  constructor(message = 'You do not have permission to perform this action') {
    super(message)
    this.name = 'AuthorizationError'
  }
}
```

### Using Custom Errors

```ts
import { NotFoundError, ValidationError } from '@/errors'

async function getUser(id: number) {
  const user = await User.find(id)

  if (!user) {
    throw new NotFoundError('User', id)
  }

  return user
}

async function createUser(data: CreateUserInput) {
  const errors: Record<string, string[]> = {}

  if (!data.email) {
    errors.email = ['Email is required']
  } else if (!isValidEmail(data.email)) {
    errors.email = ['Email format is invalid']
  }

  if (!data.password) {
    errors.password = ['Password is required']
  } else if (data.password.length < 8) {
    errors.password = ['Password must be at least 8 characters']
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors)
  }

  return User.create(data)
}
```

## Global Error Handler

### Error Handler Middleware

```ts
// middleware/errorHandler.ts
import { HttpError } from '@stacksjs/error-handling'
import { ValidationError, NotFoundError, AuthenticationError } from '@/errors'

export async function errorHandler(error: Error, request: Request): Promise<Response> {
  // Log error details
  console.error('Error:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
  })

  // Handle specific error types
  if (error instanceof ValidationError) {
    return Response.json({
      error: 'Validation Error',
      message: error.message,
      errors: error.errors,
    }, { status: 422 })
  }

  if (error instanceof NotFoundError) {
    return Response.json({
      error: 'Not Found',
      message: error.message,
    }, { status: 404 })
  }

  if (error instanceof AuthenticationError) {
    return Response.json({
      error: 'Unauthorized',
      message: error.message,
    }, { status: 401 })
  }

  if (error instanceof HttpError) {
    return Response.json({
      error: getStatusText(error.statusCode),
      message: error.message,
    }, { status: error.statusCode })
  }

  // Handle unexpected errors
  const isProduction = process.env.APP_ENV === 'production'

  return Response.json({
    error: 'Internal Server Error',
    message: isProduction ? 'An unexpected error occurred' : error.message,
    ...(isProduction ? {} : { stack: error.stack }),
  }, { status: 500 })
}

function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  }
  return statusTexts[status] || 'Error'
}
```

### Wrapping Route Handlers

```ts
type RouteHandler = (request: Request) => Promise<Response>

function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (request: Request) => {
    try {
      return await handler(request)
    } catch (error) {
      return errorHandler(error as Error, request)
    }
  }
}

// Usage
router.get('/users/:id', withErrorHandling(async (request) => {
  const { id } = request.params
  const user = await getUser(parseInt(id))
  return Response.json(user)
}))
```

## Try-Catch Patterns

### Basic Pattern

```ts
async function fetchUserOrders(userId: number) {
  try {
    const user = await User.find(userId)

    if (!user) {
      throw new NotFoundError('User', userId)
    }

    const orders = await Order.where('user_id', '=', userId).get()

    return orders
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error // Re-throw known errors
    }

    // Log unexpected errors
    console.error('Failed to fetch user orders:', error)
    throw new HttpError(500, 'Failed to fetch orders')
  }
}
```

### With Cleanup

```ts
async function processFile(filePath: string) {
  let fileHandle = null

  try {
    fileHandle = await Bun.file(filePath).stream()
    // Process file...
    return result
  } catch (error) {
    console.error('File processing failed:', error)
    throw new HttpError(500, 'Failed to process file')
  } finally {
    // Cleanup runs regardless of success/failure
    if (fileHandle) {
      // Close file handle if needed
    }
  }
}
```

### Multiple Operations

```ts
async function createOrderWithPayment(userId: number, items: CartItem[]) {
  const order = await Order.create({
    user_id: userId,
    status: 'pending',
  })

  try {
    // Add order items
    await OrderItem.createMany(items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
    })))

    // Process payment
    const payment = await processPayment(order)

    // Update order status
    await order.update({ status: 'paid', payment_id: payment.id })

    return order
  } catch (error) {
    // Rollback: Delete the order if payment fails
    await order.delete()

    if (error instanceof PaymentError) {
      throw new HttpError(402, error.message)
    }

    throw error
  }
}
```

## Async Error Handling

### Promise.all with Error Handling

```ts
async function fetchAllUserData(userId: number) {
  const [userResult, ordersResult, notificationsResult] = await Promise.allSettled([
    User.find(userId),
    Order.where('user_id', '=', userId).get(),
    Notification.where('user_id', '=', userId).get(),
  ])

  const errors: string[] = []

  if (userResult.status === 'rejected') {
    errors.push(`Failed to fetch user: ${userResult.reason}`)
  }

  if (ordersResult.status === 'rejected') {
    errors.push(`Failed to fetch orders: ${ordersResult.reason}`)
  }

  if (notificationsResult.status === 'rejected') {
    errors.push(`Failed to fetch notifications: ${notificationsResult.reason}`)
  }

  return {
    user: userResult.status === 'fulfilled' ? userResult.value : null,
    orders: ordersResult.status === 'fulfilled' ? ordersResult.value : [],
    notifications: notificationsResult.status === 'fulfilled' ? notificationsResult.value : [],
    errors: errors.length > 0 ? errors : undefined,
  }
}
```

### Retry Pattern

```ts
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    delay?: number
    backoff?: number
  } = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000, backoff = 2 } = options

  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      console.warn(`Attempt ${attempt} failed:`, error)

      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(backoff, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  throw lastError!
}

// Usage
const result = await withRetry(
  () => fetchExternalAPI(),
  { maxRetries: 3, delay: 1000 }
)
```

## Logging Errors

### Structured Logging

```ts
interface ErrorLog {
  timestamp: string
  level: 'error' | 'warn' | 'info'
  message: string
  error?: {
    name: string
    message: string
    stack?: string
  }
  context?: Record<string, any>
  request?: {
    method: string
    url: string
    headers: Record<string, string>
  }
}

function logError(
  error: Error,
  context?: Record<string, any>,
  request?: Request
): void {
  const log: ErrorLog = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: error.message,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
  }

  if (request) {
    log.request = {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
    }
  }

  console.error(JSON.stringify(log))

  // Send to external service in production
  if (process.env.APP_ENV === 'production') {
    sendToErrorTracking(log)
  }
}
```

### Error Tracking Integration

```ts
import * as Sentry from '@sentry/bun'

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.APP_ENV,
  tracesSampleRate: 1.0,
})

function captureError(error: Error, context?: Record<string, any>): void {
  Sentry.captureException(error, {
    extra: context,
  })
}

// Usage in error handler
export async function errorHandler(error: Error, request: Request): Promise<Response> {
  // Capture to Sentry
  captureError(error, {
    url: request.url,
    method: request.method,
  })

  // Continue with normal error handling...
}
```

## Debugging

### Debug Mode

```ts
const DEBUG = process.env.APP_DEBUG === 'true'

function debug(...args: any[]): void {
  if (DEBUG) {
    console.log('[DEBUG]', new Date().toISOString(), ...args)
  }
}

function debugError(error: Error, context?: string): void {
  if (DEBUG) {
    console.error(`[DEBUG ERROR] ${context || 'Error'}:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
  }
}
```

### Request Debugging

```ts
function debugRequest(request: Request): void {
  if (!DEBUG) return

  console.log('[DEBUG REQUEST]', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
  })
}

function debugResponse(response: Response, duration: number): void {
  if (!DEBUG) return

  console.log('[DEBUG RESPONSE]', {
    status: response.status,
    duration: `${duration}ms`,
    headers: Object.fromEntries(response.headers.entries()),
  })
}
```

## API Error Responses

### Consistent Error Format

```ts
interface ApiError {
  error: string
  message: string
  code?: string
  errors?: Record<string, string[]>
  trace_id?: string
}

function createErrorResponse(
  status: number,
  message: string,
  options?: {
    code?: string
    errors?: Record<string, string[]>
  }
): Response {
  const traceId = randomUUIDv7()

  const body: ApiError = {
    error: getStatusText(status),
    message,
    trace_id: traceId,
    ...options,
  }

  return Response.json(body, {
    status,
    headers: {
      'X-Trace-ID': traceId,
    },
  })
}

// Usage
return createErrorResponse(422, 'Validation failed', {
  code: 'VALIDATION_ERROR',
  errors: {
    email: ['Email is required'],
    password: ['Password must be at least 8 characters'],
  },
})
```

## Best Practices

1. **Be specific** - Use specific error types for different scenarios
2. **Don't swallow errors** - Always log or re-throw errors
3. **Provide context** - Include relevant information in error messages
4. **Secure in production** - Hide stack traces and internal details
5. **Use error boundaries** - Catch errors at appropriate levels
6. **Monitor errors** - Use error tracking services in production
7. **Test error paths** - Write tests for error scenarios

```ts
// Good: Specific error with context
throw new NotFoundError('User', userId)

// Bad: Generic error without context
throw new Error('Not found')

// Good: Log and re-throw
try {
  await processOrder(order)
} catch (error) {
  console.error('Order processing failed:', { orderId: order.id, error })
  throw error
}

// Bad: Swallowing error
try {
  await processOrder(order)
} catch (error) {
  // Error is lost!
}
```

This documentation covers the essential error handling patterns and debugging techniques. Each approach is designed for robust and maintainable error management.
