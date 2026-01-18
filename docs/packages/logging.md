# Logging Package

A comprehensive logging system powered by Clarity, providing structured logging, multiple output channels, log levels, file rotation, and debugging utilities.

## Installation

```bash
bun add @stacksjs/logging
```

## Basic Usage

```typescript
import { log } from '@stacksjs/logging'

// Log messages at different levels
log.info('Application started')
log.success('User created successfully')
log.warn('API rate limit approaching')
log.error('Failed to connect to database')
log.debug('Processing request:', { userId: 123 })
```

## Log Levels

### Available Levels

```typescript
import { log } from '@stacksjs/logging'

// Info - General information
log.info('Server listening on port 3000')

// Success - Successful operations
log.success('Build completed in 2.3s')

// Warning - Potential issues
log.warn('Deprecated API endpoint used')
log.warning('Memory usage above 80%') // Alias

// Error - Errors and failures
log.error('Database connection failed')
log.error(new Error('Something went wrong'))

// Debug - Detailed debugging information
log.debug('Request headers:', headers)
log.debug('SQL query:', query)
```

### Log Level Configuration

```env
# Set minimum log level
LOG_LEVEL=info

# Available levels: debug, info, warn, error
# debug shows all, error shows only errors
```

```typescript
// Programmatic level setting
import { Logger } from '@stacksjs/logging'

const logger = new Logger('myapp', {
  level: 'debug' // 'debug' | 'info' | 'warn' | 'error'
})
```

## Debugging Utilities

### Dump

```typescript
import { dump, log } from '@stacksjs/logging'

// Dump variables for debugging (doesn't stop execution)
dump(user)
dump({ name: 'John', roles: ['admin'] })

// Via log
log.dump(someObject)
log.dump(complexData, 'with label')
```

### Dump and Die

```typescript
import { dd } from '@stacksjs/logging'

// Dump and exit (stops execution)
dd(user)
// Program exits after this

// Via log
log.dd(object) // Logs and exits with code 1
```

### Echo

```typescript
import { echo } from '@stacksjs/logging'

// Simple echo (less verbose than info)
echo('Simple message')
echo(object) // Pretty prints objects
```

## Structured Logging

### Logging Objects

```typescript
log.info('User action', {
  userId: 123,
  action: 'login',
  ip: '192.168.1.1',
  timestamp: new Date()
})

log.error('Request failed', {
  error: error.message,
  stack: error.stack,
  requestId: 'abc-123'
})
```

### Multiple Arguments

```typescript
// Multiple values are formatted and joined
log.info('Processing', itemCount, 'items')
log.debug('User:', user, 'Roles:', roles)
```

## Timing Operations

### Time Tracking

```typescript
// Start a timer
const endTimer = log.time('database-query')

// Perform operation
await database.query(sql)

// End timer and log duration
await endTimer({ rows: results.length })
// Output: [database-query] 125ms { rows: 50 }
```

### Manual Timing

```typescript
const start = Date.now()

// Do work...

log.info(`Operation completed in ${Date.now() - start}ms`)
```

## File Logging

### Default Configuration

```typescript
import { Logger } from '@stacksjs/logging'

const logger = new Logger('myapp', {
  level: 'info',
  logDirectory: 'storage/logs',
  writeToFile: true,
  fancy: true, // Pretty console output
  showTags: false
})
```

### Log Files

Logs are written to the configured directory:

```
storage/logs/
  stacks-2024-01-15.log
  stacks-2024-01-16.log
  stacks-error-2024-01-15.log
```

### File Format

```
[2024-01-15 10:30:45] INFO: Application started
[2024-01-15 10:30:46] SUCCESS: Database connected
[2024-01-15 10:30:47] ERROR: Failed to load config {"file":"app.config.ts"}
```

## Error Handling Integration

### Logging Errors

```typescript
import { log } from '@stacksjs/logging'
import { handleError } from '@stacksjs/error-handling'

try {
  await riskyOperation()
} catch (error) {
  // Log error with context
  log.error(error, {
    context: 'riskyOperation',
    userId: currentUser.id
  })

  // Or use error handling integration
  handleError(error)
}
```

### Error Options

```typescript
log.error(error, {
  shouldExit: true,  // Exit process after logging
  silent: false,     // Show in console
  message: 'Custom error message'
})
```

## Logger Configuration

### Creating Custom Loggers

```typescript
import { Logger } from '@stacksjs/logging'

// Create a named logger
const apiLogger = new Logger('api', {
  level: 'debug',
  logDirectory: 'storage/logs/api',
  writeToFile: true,
  fancy: true
})

// Use the logger
apiLogger.info('API request received')
apiLogger.debug('Request body:', body)
```

### Logger Options

```typescript
interface LoggerOptions {
  // Minimum log level
  level: 'debug' | 'info' | 'warn' | 'error'

  // Directory for log files
  logDirectory: string

  // Enable file writing
  writeToFile: boolean

  // Pretty console output
  fancy: boolean

  // Show category tags
  showTags: boolean
}
```

## Context and Metadata

### Adding Context

```typescript
// Log with structured context
log.info('Order processed', {
  orderId: 'ORD-12345',
  customerId: 'CUST-67890',
  amount: 99.99,
  items: 3
})

// Error with context
log.error('Payment failed', {
  orderId: 'ORD-12345',
  error: paymentError.message,
  gateway: 'stripe'
})
```

### Request Context

```typescript
// In middleware or action
async function handle(request) {
  const requestId = crypto.randomUUID()

  log.info('Request received', {
    requestId,
    method: request.method,
    path: request.url,
    userAgent: request.headers.get('user-agent')
  })

  // ... handle request

  log.info('Response sent', {
    requestId,
    status: 200,
    duration: Date.now() - start
  })
}
```

## Console Output

### Fancy Mode

When `fancy: true` (default), logs are formatted with colors and symbols:

```
 INFO  Application started
 SUCCESS  Database connected  ✓
 WARN  Memory usage high
 ERROR  Connection failed  ✗
 DEBUG  Query executed in 15ms
```

### Plain Mode

When `fancy: false`, simpler output:

```
[INFO] Application started
[SUCCESS] Database connected
[WARN] Memory usage high
[ERROR] Connection failed
```

## Environment-Based Configuration

```typescript
// Automatic configuration based on environment
const logger = new Logger('app', {
  // More verbose in development
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

  // File logging in production
  writeToFile: process.env.NODE_ENV === 'production',

  // Fancy output in development
  fancy: process.env.NODE_ENV !== 'production'
})
```

## Performance Logging

### Measuring Performance

```typescript
// Time a function
const timer = log.time('expensive-operation')

const result = await expensiveOperation()

await timer({ resultSize: result.length })
```

### Query Logging

```typescript
// Log database queries
log.debug('SQL Query', {
  query: sql,
  params: bindings,
  duration: queryTime
})
```

## Log Rotation

Logs are automatically rotated daily:

```
storage/logs/
  stacks-2024-01-13.log
  stacks-2024-01-14.log
  stacks-2024-01-15.log  (current)
```

### Custom Rotation

```typescript
// Configure via Clarity
import { Logger } from '@stacksjs/clarity'

const logger = new Logger('app', {
  rotation: {
    maxSize: '10MB',
    maxFiles: 30,
    compress: true
  }
})
```

## Edge Cases

### Handling Circular References

```typescript
// Objects with circular references are safely stringified
const obj = { name: 'test' }
obj.self = obj

log.info('Circular object:', obj)
// Output: Circular object: {"name":"test","self":"[Circular]"}
```

### Handling Large Objects

```typescript
// Large objects are truncated in console
const largeArray = new Array(10000).fill({ data: 'value' })
log.debug('Large array:', largeArray)
// Console shows truncated version, file has full log
```

### Async Logging

```typescript
// Logging is async but you usually don't need to await
log.info('This logs asynchronously')

// Await if you need to ensure log is written
await log.info('Important message')
```

### Graceful Shutdown

```typescript
// Ensure logs are flushed before exit
process.on('SIGTERM', async () => {
  await log.info('Shutting down...')
  // Wait for logs to flush
  await new Promise(resolve => setTimeout(resolve, 100))
  process.exit(0)
})
```

## Best Practices

### Structured Logging

```typescript
// Good: Structured data
log.info('User action', { userId: 1, action: 'login' })

// Avoid: String concatenation
log.info(`User ${userId} performed action ${action}`)
```

### Appropriate Log Levels

```typescript
// DEBUG: Development details
log.debug('SQL query executed', { sql, duration })

// INFO: Business events
log.info('Order created', { orderId })

// WARN: Potential issues
log.warn('API deprecation', { endpoint, deadline })

// ERROR: Failures
log.error('Payment failed', { error, orderId })
```

### Sensitive Data

```typescript
// Don't log sensitive data
log.info('User login', {
  userId: user.id,
  email: user.email,
  // password: user.password  // Never log passwords!
})

// Mask sensitive fields
log.info('Payment processed', {
  cardLast4: card.number.slice(-4),
  // cardNumber: card.number  // Never log full card numbers!
})
```

## API Reference

### Log Methods

| Method | Description |
|--------|-------------|
| `log.info(...args)` | Info level message |
| `log.success(msg)` | Success level message |
| `log.warn(msg)` | Warning level message |
| `log.warning(msg)` | Alias for warn |
| `log.error(err, opts?)` | Error level message |
| `log.debug(...args)` | Debug level message |
| `log.dump(...args)` | Dump objects for debugging |
| `log.dd(...args)` | Dump and die |
| `log.echo(...args)` | Simple echo |
| `log.time(label)` | Start timer, returns end function |

### Helper Functions

| Function | Description |
|----------|-------------|
| `dump(...args)` | Dump objects |
| `dd(...args)` | Dump and die |
| `echo(...args)` | Echo output |
| `logger()` | Get logger instance |

### Logger Class

| Method | Description |
|--------|-------------|
| `new Logger(name, opts)` | Create logger |
| `logger.info(msg)` | Info message |
| `logger.success(msg)` | Success message |
| `logger.warn(msg)` | Warning message |
| `logger.error(msg)` | Error message |
| `logger.debug(msg)` | Debug message |
| `logger.time(label)` | Timer function |
