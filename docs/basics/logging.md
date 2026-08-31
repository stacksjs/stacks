---
title: Application Logging
description: "Stacks provides a powerful logging system built on Clarity, offering structured logging, multiple output channels, and beautiful console formatting."
---
# Logging

Stacks provides a powerful logging system built on [Clarity](https://github.com/stacksjs/clarity), offering structured logging, multiple output channels, and beautiful console formatting.

## Overview

The Stacks logging system helps you:

- **Debug** - Track application behavior and issues
- **Monitor** - Log errors and exceptions for observability
- **Audit** - Create audit trails for compliance
- **Analyze** - Understand application performance

## Quick Start

```typescript
import { log } from '@stacksjs/logging'

// Basic logging
log.info('User logged in', { userId: 123 })
log.warn('Rate limit approaching', { current: 90, max: 100 })
log.error('Payment failed', { orderId: 456, error: 'Card declined' })
log.debug('Query executed', { sql: 'SELECT * FROM users', ms: 45 })
log.success('Order completed', { orderId: 789 })
```

## Log Levels

Stacks supports standard log levels, ordered from most to least severe:

| Level | Method | Description | Use Case |
|-------|--------|-------------|----------|
| `error` | `log.error()` | Critical errors | Exceptions, failed operations |
| `warn` | `log.warn()` | Warning conditions | Deprecations, approaching limits |
| `info` | `log.info()` | Informational | User actions, state changes |
| `debug` | `log.debug()` | Debug details | Development, troubleshooting |
| `success` | `log.success()` | Success confirmations | Completed operations |

### Setting Log Level

Set the minimum log level via environment variable:

```bash
# .env
LOG_LEVEL=debug  # Shows all logs
LOG_LEVEL=info   # Shows info, warn, error, success
LOG_LEVEL=warn   # Shows warn and error only
LOG_LEVEL=error  # Shows only errors
```

## Structured Logging

### Logging with Context

Always log structured data for better analysis:

```typescript
// Good: Structured data
log.info('Order processed', {
  orderId: order.id,
  userId: order.userId,
  total: order.total,
  items: order.items.length,
})

// Avoid: String concatenation
log.info(`Order ${order.id} processed for user ${order.userId}`)
```

### Error Logging

```typescript
try {
  await processPayment(order)
} catch (error) {
  log.error('Payment failed', {
    error: error.message,
    stack: error.stack,
    orderId: order.id,
    amount: order.total,
  })
  throw error
}
```

## Helper Functions

### dump() - Debug Output

Output values without stopping execution:

```typescript
import { dump } from '@stacksjs/logging'

const data = await fetchData()
dump(data)  // Logs to debug level
// Execution continues
```

### dd() - Dump and Die

Output values and stop execution (useful for debugging):

```typescript
import { dd } from '@stacksjs/logging'

const result = await processData()
dd(result)  // Logs and exits
// Code below never executes
```

### Performance Timing

```typescript
const endTimer = log.time('database-query')

const users = await db.select().from('users').execute()

await endTimer({ rowCount: users.length })
// Output: database-query completed in 45ms { rowCount: 100 }
```

## Configuration

Configure logging in `config/logging.ts`:

```typescript
import type { LogRecord } from '@stacksjs/types'

export default {
  // Minimum level the console prints. Optional; see precedence below.
  level: 'info',

  // 'text' (default in development) or 'json' (default in production)
  format: 'text',

  // Where the log file goes. Only its directory is used.
  logsPath: 'storage/logs/stacks.log',

  // Write logs to file as well as the console
  writeToFile: true,

  // Ship the log stream somewhere else - see below
  transports: [],
}
```

### Level precedence

**`LOG_LEVEL` env var > `config/logging.ts` > `info`.** The env var is there so a
single run can be made verbose without editing the project; the config file is
the setting the project ships with.

### Transports

A transport receives every record *before* formatting collapses it, so `args`
still holds the real `Error` and the real context object. That is the seam for
shipping logs to a log service, an OTel exporter, or a test sink, without
rewriting a single call site.

```typescript
export default {
  transports: [
    {
      name: 'log-service',
      // Optional: this transport's own floor. Omit it to receive everything,
      // including debug records the console is configured to suppress.
      level: 'warning',
      log(record: LogRecord) {
        void fetch('https://logs.example.com/ingest', {
          method: 'POST',
          body: JSON.stringify(record),
        })
      },
      // Optional: called on shutdown, for a transport that batches.
      async flush() {},
    },
  ],
}
```

A transport that throws is contained and reported once on stderr, then left
alone - the logger is frequently the thing reporting a failure and must not
become a second one.

To attach one from a package rather than from the project's config, use
`registerTransport()`, which returns a function that detaches it:

```typescript
import { registerTransport } from '@stacksjs/logging'

const detach = registerTransport({ name: 'my-sink', log: record => sink.push(record) })
```

Records emitted before `config/logging.ts` has finished loading do not reach the
transports it declares - they do not exist yet. Everything from that point on
does. `await logger()` resolves once the config has been applied, if you need to
wait for it (but never call it from inside a `config/*.ts` file, which would
wait on its own load).

## Log Channels

### Console Channel

Logs are output to the terminal with beautiful formatting:

```typescript
log.info('Request received', {
  method: 'GET',
  path: '/api/users',
  ip: '192.168.1.1'
})

// Output:
// [2024-01-15 10:30:45] INFO: Request received
//   method: GET
//   path: /api/users
//   ip: 192.168.1.1
```

### File Channel

Logs are written to files in `storage/logs/`:

```
storage/logs/
  stacks.log           # Main log file
  stacks-2024-01-15.log  # Daily rotation
  errors.log           # Error-only log
```

## Contextual Logging

### Request Context

Add context to all logs within a request:

```typescript
// In middleware
export async function loggingMiddleware(request, next) {
  const requestId = crypto.randomUUID()

  const scopedLog = log.withContext({
    requestId,
    path: request.url,
    method: request.method,
  })

  scopedLog.info('Request started')

  try {
    const response = await next()
    scopedLog.info('Request completed', { status: response.status })
    return response
  } catch (error) {
    scopedLog.error('Request failed', { error: error.message })
    throw error
  }
}
```

## Best Practices

### DO

- **Use structured logging** - Pass objects, not concatenated strings
- **Include context** - Add relevant IDs (user, request, order)
- **Log at appropriate levels** - Don't log debug info at error level
- **Redact sensitive data** - Never log passwords, tokens, or PII

### DON'T

- **Don't log sensitive data** - Passwords, tokens, credit cards
- **Don't over-log** - Too many logs make debugging harder
- **Don't log in tight loops** - Can cause performance issues

## Related Resources

### Underlying Libraries

- **[Clarity](https://github.com/stacksjs/clarity)** - The logging library powering Stacks logging

### Related Stacks Packages

- **[Error Handling Package](/packages/error-handling)** - Error handling and logging
- **[Config Package](/packages/config)** - Configure log settings

### Related Guides

- **[Error Handling](/basics/error-handling)** - Handling and logging errors
- **[Debugging](/basics/logging)** - Debug techniques
