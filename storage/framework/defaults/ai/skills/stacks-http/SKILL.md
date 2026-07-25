---
name: stacks-http
description: Use when working with HTTP utilities in a Stacks application — HTTP status codes, making outbound HTTP requests via HttxClient, reactive fetch composables (useFetch/createFetch), or HTTP-related helpers. Covers @stacksjs/http, @stacksjs/httx, and the fetch composables in @stacksjs/composables.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks HTTP

## Key Paths
- Core package: `storage/framework/core/http/src/`
- Composables (useFetch/createFetch): `storage/framework/core/composables/src/useFetch.ts`, `storage/framework/core/composables/src/createFetch.ts`
- Buddy CLI command: `storage/framework/core/buddy/src/commands/http.ts`
- httx dependency (installed): `node_modules/@stacksjs/httx/`
- Package: `@stacksjs/http` (status codes), `@stacksjs/httx` (HTTP client), `@stacksjs/composables` (useFetch/createFetch)

## Source Files
```
http/src/
└── index.ts           # Response enum — all HTTP status codes (100-511)

composables/src/
├── useFetch.ts        # Chainable reactive fetch composable (builder pattern)
└── createFetch.ts     # Factory for pre-configured useFetch with baseUrl

buddy/src/commands/
└── http.ts            # `buddy http [domain]` CLI command using HttxClient
```

## Response Enum — HTTP Status Codes (index.ts)

The `@stacksjs/http` package exports a single `Response` enum with all standard HTTP status codes:

```typescript
import { Response } from '@stacksjs/http'

Response.HTTP_OK                    // 200
Response.HTTP_CREATED               // 201
Response.HTTP_NO_CONTENT            // 204
Response.HTTP_MOVED_PERMANENTLY     // 301
Response.HTTP_NOT_MODIFIED          // 304
Response.HTTP_BAD_REQUEST           // 400
Response.HTTP_UNAUTHORIZED          // 401
Response.HTTP_FORBIDDEN             // 403
Response.HTTP_NOT_FOUND             // 404
Response.HTTP_UNPROCESSABLE_ENTITY  // 422
Response.HTTP_TOO_MANY_REQUESTS     // 429
Response.HTTP_INTERNAL_SERVER_ERROR // 500
Response.HTTP_SERVICE_UNAVAILABLE   // 503
```

### Full Status Code Categories
- **1xx Informational**: `HTTP_CONTINUE` (100), `HTTP_SWITCHING_PROTOCOLS` (101)
- **2xx Success**: `HTTP_OK` (200), `HTTP_CREATED` (201), `HTTP_ACCEPTED` (202), `HTTP_NON_AUTHORITATIVE_INFORMATION` (203), `HTTP_NO_CONTENT` (204), `HTTP_RESET_CONTENT` (205), `HTTP_PARTIAL_CONTENT` (206)
- **3xx Redirection**: `HTTP_MULTIPLE_CHOICES` (300), `HTTP_MOVED_PERMANENTLY` (301), `HTTP_FOUND` (302), `HTTP_SEE_OTHER` (303), `HTTP_NOT_MODIFIED` (304), `HTTP_USE_PROXY` (305), `HTTP_UNUSED` (306), `HTTP_TEMPORARY_REDIRECT` (307), `HTTP_PERMANENT_REDIRECT` (308)
- **4xx Client Error**: `HTTP_BAD_REQUEST` (400) through `HTTP_UNAVAILABLE_FOR_LEGAL_REASONS` (451) — includes `HTTP_I_AM_A_TEAPOT` (418)
- **5xx Server Error**: `HTTP_INTERNAL_SERVER_ERROR` (500) through `HTTP_NETWORK_AUTHENTICATION_REQUIRED` (511)

## HttxClient — Outbound HTTP Client (@stacksjs/httx)

The `@stacksjs/httx` package provides the `HttxClient` class for making outbound HTTP requests. It wraps Bun's `fetch()` with retry logic, timeouts, timing data, and Result-based error handling via `ts-error-handling`.

```typescript
import { HttxClient } from '@stacksjs/httx'

const client = new HttxClient(config?: Partial<HttxConfig>)
const result = await client.request<T>(url: string, options: RequestOptions): Promise<Result<HttxResponse<T>, Error>>
```

### HttxConfig
```typescript
interface HttxConfig {
  verbose?: boolean | string[]       // Enable debug logging (or filter by category)
  defaultHeaders?: Record<string, string>
  baseUrl?: string                   // Prepended to all request URLs
  timeout?: number                   // Request timeout in ms
  retry?: RetryOptions               // Default retry configuration
}
```

### RequestOptions
```typescript
interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  query?: Record<string, string>     // URL query parameters
  form?: boolean                     // Send body as form-encoded
  multipart?: boolean                // Send body as multipart/form-data
  json?: boolean                     // Send body as JSON
  unix?: string                      // Unix socket path
  proxy?: string                     // Proxy URL
  downloadProgress?: (progress: number) => void
  retry?: RetryOptions               // Per-request retry override
  stream?: boolean                   // Stream response
  acceptHeader?: string              // Override Accept header
  verbose?: boolean
  timeout?: number
  body?: BodyInit | Record<string, string>
  headers?: HeadersInit
}
```

### RetryOptions
```typescript
interface RetryOptions {
  retries?: number                   // Max retry attempts
  retryDelay?: number                // Base delay between retries (ms)
  retryOn?: number[]                 // HTTP status codes that trigger retry
  shouldRetry?: (error: Error, attempt: number) => boolean  // Custom retry predicate
}
```

### HttxResponse
```typescript
interface HttxResponse<T = unknown> {
  status: number
  statusText: string
  headers: Headers
  data: T
  timings: {
    start: number
    end: number
    duration: number                 // Total request duration in ms
  }
}
```

### Result Pattern (from ts-error-handling)
`client.request()` returns a `Result<HttxResponse<T>, Error>`. Use `.match()` to handle success/failure:

```typescript
const result = await client.request('https://api.example.com/users', {
  method: 'GET',
})

result.match({
  ok: (response) => {
    console.log(response.status)          // 200
    console.log(response.timings.duration) // e.g. 142 (ms)
    console.log(response.data)            // parsed response body
  },
  err: (error) => {
    console.error(error.message)
  },
})
```

Or use `result.isOk` / `result.value` / `result.error` directly.

### Error Classes
```typescript
class HttxError extends Error {
  readonly context?: Record<string, unknown>
}

class HttxRequestError extends HttxError {
  readonly method: string
  readonly url: string
  readonly statusCode?: number
}

class HttxTimeoutError extends HttxError {
  readonly method: string
  readonly url: string
  readonly timeout: number
}

class HttxNetworkError extends HttxError {
  readonly method: string
  readonly url: string
  readonly originalError?: Error
}

class HttxResponseError extends HttxRequestError {
  readonly statusText: string
  readonly responseBody?: unknown
}
```

### Utility Exports
```typescript
import { debugLog, sleep } from '@stacksjs/httx'

debugLog(category: string, message: string | (() => string), verbose?: boolean | string[]): void
sleep(ms: number): Promise<void>
```

### Config Exports
```typescript
import { config, defaultConfig, getConfig } from '@stacksjs/httx'

const config: HttxConfig               // Synchronous access with default fallback
const defaultConfig: HttxConfig         // Default configuration object
function getConfig(): Promise<HttxConfig>  // Async config loader
```

## useFetch — Reactive Fetch Composable (@stacksjs/composables)

A chainable, reactive fetch composable using the builder pattern. Uses native `fetch()` under the hood (not HttxClient). Returns reactive `Ref` values from `@stacksjs/stx`.

```typescript
import { useFetch } from '@stacksjs/composables'

// Builder pattern: method -> format -> result
const { data, error, isFetching } = await useFetch('/api/posts').get().json()
```

### FetchBuilder Interface
```typescript
interface FetchBuilder {
  get: () => FetchBuilder
  post: (body?: string) => FetchBuilder
  patch: (body?: string) => FetchBuilder
  put: (body?: string) => FetchBuilder
  delete: () => FetchBuilder
  json: () => UseFetchResult
}
```

### UseFetchResult Interface
```typescript
interface UseFetchResult {
  data: Ref<any>          // Reactive ref — populated with parsed JSON on success
  error: Ref<any>         // Reactive ref — populated with error JSON or Error object
  isFetching: Ref<boolean>  // Starts as true, becomes false when request completes
  then: (resolve: (value: { data: Ref<any>, error: Ref<any> }) => void) => Promise<void>
}
```

### Usage Examples

```typescript
import { useFetch } from '@stacksjs/composables'

// GET request
const { data, error } = await useFetch('/api/users').get().json()

// POST with JSON body
const { data, error } = await useFetch('/api/users')
  .post(JSON.stringify({ name: 'Alice', email: 'alice@example.com' }))
  .json()

// PATCH with body
const { data, error } = await useFetch('/api/users/1')
  .patch(JSON.stringify({ name: 'Updated' }))
  .json()

// DELETE
const { data, error } = await useFetch('/api/users/1').delete().json()

// Synchronous access (reactive — updates when request completes)
const result = useFetch('/api/items').get().json()
result.isFetching.value  // true (synchronously, before microtask resolves)
// ... later ...
result.data.value        // parsed JSON response
result.isFetching.value  // false
```

### How json() Works Internally
1. Builds a `RequestInit` with the configured method and `Accept: application/json` header
2. For POST/PATCH/PUT with a body, also sets `Content-Type: application/json`
3. Calls native `fetch(url, init)`
4. On success (`response.ok`), parses JSON into `data.value`
5. On HTTP error, parses JSON into `error.value`
6. On network error, sets `error.value` to the caught Error
7. Always sets `isFetching.value = false` in `finally`

## createFetch — Pre-configured Fetch Factory (@stacksjs/composables)

Creates a reusable `useFetch` instance with a pre-configured base URL.

```typescript
import { createFetch } from '@stacksjs/composables'

interface CreateFetchOptions {
  baseUrl?: string          // Base URL prepended to all requests
  options?: RequestInit     // Default options (currently unused in implementation)
}

const useApi = createFetch({ baseUrl: 'https://api.example.com' })

// URL becomes: https://api.example.com/users
const { data, error } = await useApi('/users').get().json()
```

### URL Resolution
`createFetch` joins the base URL and path by stripping trailing/leading slashes:
- `baseUrl: 'https://api.example.com/'` + `'/users'` → `'https://api.example.com/users'`
- `baseUrl: 'https://api.example.com'` + `'users'` → `'https://api.example.com/users'`

## CLI Command — buddy http

```bash
buddy http [domain]          # Send a GET request (defaults to config.app.url)
buddy http example.com       # GET https://example.com
buddy http -v example.com    # Verbose output
```

The CLI command uses `HttxClient` from `@stacksjs/httx`:
- Prepends `https://` if the URL does not start with `http`
- Logs status code, status text, and duration
- Prints response body (string or pretty-printed JSON)

## Gotchas
- **`@stacksjs/http` is status codes only** — it exports a single `Response` enum with HTTP status code constants. It does NOT contain an HTTP client, request helpers, or fetch utilities
- **The actual HTTP client is `@stacksjs/httx`** — a separate package (not part of `@stacksjs/http`). It is used by `buddy http` and available for general use
- **`useFetch` uses native `fetch()`, not HttxClient** — despite `@stacksjs/httx` being available, the `useFetch` composable calls the global `fetch()` directly
- **`useFetch` only supports `.json()` format** — there is no `.text()`, `.blob()`, or `.arrayBuffer()` method. The only terminal method is `.json()`
- **Method chaining overrides previous method** — calling `.post('body').get()` will send a GET request (last method wins, body is cleared for GET/DELETE)
- **`createFetch` ignores the `options` parameter** — the `CreateFetchOptions.options` field is declared in the interface but not used in the implementation
- **`useFetch` body is only sent for POST/PATCH/PUT** — GET and DELETE requests strip the body even if one was set
- **The `Response` enum name conflicts with the global `Response`** — importing `Response` from `@stacksjs/http` shadows the native Fetch API `Response` type. Use a named import alias if both are needed: `import { Response as HttpStatus } from '@stacksjs/http'`
- **HttxClient uses Result pattern** — `request()` returns `Result<HttxResponse, Error>` from `ts-error-handling`, not a plain Promise. Use `.match()`, `.isOk`, or `.value`/`.error` to unwrap
- **`useFetch` returns reactive Refs** — `data`, `error`, and `isFetching` are `Ref<T>` from `@stacksjs/stx`. Access values via `.value` property
- **No request interceptors or middleware** — neither `useFetch` nor `HttxClient` support request/response interceptors
- **For API route handling, use `@stacksjs/router`** — `@stacksjs/http` and `@stacksjs/httx` are for outbound requests only, not for defining API endpoints
