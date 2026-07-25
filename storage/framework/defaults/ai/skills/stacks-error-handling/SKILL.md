---
name: stacks-error-handling
description: Use when implementing error handling in Stacks — the Result type (Ok/Err), handleError function, error page rendering (development with stack traces, production with friendly messages), ErrorHandler class, ModelNotFoundException, HTTP error mapping, log file writing, or error configuration. Covers @stacksjs/error-handling and config/errors.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Error Handling

Type-safe error handling with Result types, error pages, and structured logging.

## Key Paths
- Core package: `storage/framework/core/error-handling/src/`
- Configuration: `config/errors.ts`
- Error model: `storage/framework/models/Error.ts`

## Result Type (from ts-error-handling)

```typescript
import { ok, err, fromPromise } from '@stacksjs/error-handling'
import type { Result, Ok, Err, ResultAsync } from '@stacksjs/error-handling'

// Create results
const success: Ok<string> = ok('data')
const failure: Err<Error> = err(new Error('failed'))

// From promises
const result: ResultAsync<Data, Error> = fromPromise(fetchData())

// Pattern matching
if (result.isOk()) {
  console.log(result.value)
} else {
  console.error(result.error)
}
```

## Error Handler

```typescript
import { handleError, ErrorHandler } from '@stacksjs/error-handling'

// Function-based
handleError(error)
handleError(error, { shouldExit: true })

// Class-based
ErrorHandler.handle(error)
ErrorHandler.handleError(error, { shouldExit: true })
ErrorHandler.writeErrorToFile(error)
ErrorHandler.writeErrorToConsole(error)
```

## Log File Writing

```typescript
import { writeToLogFile, setLogPath } from '@stacksjs/error-handling'

setLogPath('/custom/log/path')
await writeToLogFile('Error message', { path: '/custom/path' })
```

Default log path: `storage/logs/stacks.log`

## Error Page Rendering

```typescript
import { ErrorPageHandler, renderError, renderErrorPage, renderProductionErrorPage, createErrorHandler, errorResponse } from '@stacksjs/error-handling'

// Development: shows stack trace, source code, file paths
const devPage = renderErrorPage(error, request)

// Production: friendly error message, no internals
const prodPage = renderProductionErrorPage(error, request)

// Auto-detect environment
const page = renderError(error, request)

// Create handler for routes
const handler = createErrorHandler()
const response = errorResponse(error, request)
```

## HTTP Error Mapping

```typescript
import { HTTP_ERRORS } from '@stacksjs/error-handling'

// Maps status codes to error details
HTTP_ERRORS[400]  // { title: 'Bad Request', ... }
HTTP_ERRORS[401]  // { title: 'Unauthorized', ... }
HTTP_ERRORS[403]  // { title: 'Forbidden', ... }
HTTP_ERRORS[404]  // { title: 'Not Found', ... }
HTTP_ERRORS[500]  // { title: 'Internal Server Error', ... }
```

## Custom Exceptions

```typescript
import { ModelNotFoundException } from '@stacksjs/error-handling'

throw new ModelNotFoundException('User not found')
```

## Error Page Types

```typescript
interface HttpError { status: number, title: string, message: string }
interface StackFrame { file: string, line: number, column: number, function?: string }
interface CodeSnippet { line: number, code: string, isHighlighted: boolean }
```

## Error Model (storage/framework/models/Error.ts)

Fields: type, message, stack (stacktrace), status, additional_info
Seeder: 10 records for testing

## config/errors.ts

Contains comprehensive validation error messages for all field types:
- String validation: required, minLength, maxLength, email, url, uuid, etc.
- Number validation: required, min, max, positive, negative, integer, etc.
- Enum validation: invalid value messages
- Date validation: format, before, after, etc.
- File validation: size, type, dimensions, etc.

## Gotchas
- Use `Result<T, E>` types instead of try/catch for recoverable errors
- `ok()` and `err()` are from `ts-error-handling` (neverthrow-compatible)
- Error pages automatically detect environment (dev shows stack traces, prod doesn't)
- `handleError()` logs to both console and file
- `ModelNotFoundException` is thrown by `findOrFail()` and `firstOrFail()` ORM methods
- The Error model persists errors to the database for tracking
- `config/errors.ts` is a comprehensive i18n-ready error message catalog
- `ErrorHandler.isTestEnvironment` prevents process exit during tests
- `ERROR_PAGE_CSS` contains built-in styling for error pages
