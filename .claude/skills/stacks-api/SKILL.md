---
name: stacks-api
description: Use when building, modifying, or debugging API endpoints in a Stacks application — defining routes, handling requests, API middleware, working with the API server, HTTP client (fetcher), API resources, or OpenAPI generation. Covers both @stacksjs/api utilities and the stacks-api server implementation.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks API

The Stacks API system comprises two packages: the `@stacksjs/api` utilities package (HTTP client, API resources, OpenAPI generation) and the `stacks-api` server (Bun HTTP server with hot-reload). Routing is delegated to `@stacksjs/router` which wraps `@stacksjs/bun-router`.

## Key Paths
- Core utilities (package): `storage/framework/core/api/src/`
- API server: `storage/framework/api/`
- Router package: `storage/framework/core/router/src/`
- Route definitions: `routes/`
- Route registry: `app/Routes.ts` (re-exports `storage/framework/defaults/app/Routes.ts`)
- Port configuration: `config/ports.ts`
- Generated OpenAPI spec: `storage/framework/api/openapi.json`
- Generated API types: `storage/framework/api/api-types.ts`
- Actions directory: `app/Actions/`
- Controllers directory: `app/Controllers/`
- Middleware directory: `app/Middleware/`
- Middleware alias map: `app/Middleware.ts`
- Package: `@stacksjs/api`

## Source Files

```
core/api/src/
├── index.ts             # Re-exports fetcher, generate-openapi, resource
├── fetcher.ts           # Fetcher HTTP client class (fluent API)
├── generate-openapi.ts  # OpenAPI 3.0 spec generator from route definitions
├── resource.ts          # JsonResource, ResourceCollection, PaginatedResourceCollection
└── types.ts             # FetcherResponse, QueryParams, BodyData, FileAttachment

framework/api/
├── dev.ts               # API server entry point (Bun --hot, file watchers)
├── build.ts             # Bun.build config for production
├── api-types.ts         # Auto-generated TypeScript types from OpenAPI spec
├── openapi.json         # Generated OpenAPI 3.0 specification
├── package.json         # Dependencies: @stacksjs/router, queue, storage, logging
└── tsconfig.json

core/router/src/
├── index.ts             # Re-exports bun-router + stacks-specific additions
├── stacks-router.ts     # Route object, serve(), url(), action/controller resolution
├── response.ts          # Response factory (json, text, html, redirect, etc.)
├── middleware.ts         # Middleware class definition
├── request-context.ts   # AsyncLocalStorage-based request context (request proxy)
├── route-loader.ts      # Loads route files from registry with auto-prefixing
├── error-handler.ts     # Ignition-style error pages, query tracking
└── action-paths.ts      # StacksActionPath type definitions

routes/
├── api.ts               # Main API routes (no prefix, loaded at /*)
├── v1.ts                # Versioned routes (loaded at /v1/*)
├── buddy.ts             # Buddy CLI routes (loaded at /buddy/*)
└── users.ts             # Example user routes (commented out)
```

## API Server (dev.ts)

The API server runs on Bun's HTTP server with hot-reload (`bun --hot run dev.ts`).

```typescript
import { serve } from '@stacksjs/router'

serve({
  port: ports.api || 3008,  // Configurable via config/ports.ts or PORT_API env
  timezone: app.timezone || 'UTC',
})
```

### Hot Reload Watchers
The dev server watches these directories for changes and auto-reloads:
- `storage/framework/core/*/src/` -- rebuilds core packages on change
- `routes/` -- detects route file changes
- `app/Actions/` -- invalidates module cache, hot-reloads actions
- `app/Controllers/` -- invalidates module cache, hot-reloads controllers
- `app/Middleware/` -- invalidates module cache, hot-reloads middleware
- `app/Models/` (user models) -- triggers `buddy generate:model-files`

Production build: `bun build.ts` bundles `dev.ts` to `dist/dev.js`.

## Route Definitions

### Route Registry (app/Routes.ts)

Routes are organized in `routes/*.ts` files and registered in `app/Routes.ts`:

```typescript
export interface RouteDefinition {
  path: string           // Route file path relative to routes/
  prefix?: string        // URL prefix (overrides key-based prefix)
  middleware?: string | string[]  // Middleware for all routes in file
}

export type RouteRegistry = Record<string, string | RouteDefinition>

export default {
  'api': 'api',                           // No prefix (special key) - routes at /*
  'v1': { path: 'v1', prefix: 'v1' },    // routes at /v1/*
  // 'admin': { path: 'admin', middleware: ['auth'] },
} satisfies RouteRegistry
```

Special keys `'api'` and `'web'` have no prefix (loaded at root `/`). All other keys auto-prefix with `/<key>`.

### Route Methods

```typescript
import { route, response } from '@stacksjs/router'

// Inline handler
route.get('/hello', () => response.json({ message: 'Hello' }))
route.post('/users', () => response.created({ id: 1 }))

// String-based handler (Action)
route.get('/subscribers', 'Actions/SubscriberIndexOrmAction')
route.post('/login', 'Actions/Auth/LoginAction')

// String-based handler (Controller@method)
route.get('/coming-soon', 'Controllers/ComingSoonController@index')
route.get('/stats', 'Controllers/QueryController@getStats')

// Route with path parameters
route.get('/foo/bar/{id}', () => response.text('hello'))
route.get('/users/{id}/posts/{postId}', handler)

// Route chaining: middleware + naming
route.get('/tokens', 'Actions/Auth/ListTokensAction').middleware('auth')
route.post('/email/subscribe', 'Actions/SubscriberEmailAction').name('email.subscribe')
route.delete('/tokens/{id}', 'Actions/Auth/RevokeTokenAction').middleware('auth').name('token.revoke')

// Route groups (prefix + middleware)
route.group({ prefix: '/auth' }, () => {
  route.post('/refresh', 'Actions/Auth/RefreshTokenAction')
  route.get('/tokens', 'Actions/Auth/ListTokensAction').middleware('auth')
})

route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')
})

// Health check (adds GET /health)
route.health()
```

### Named Routes & URL Generation

```typescript
import { url } from '@stacksjs/router'

// Define named routes
route.get('/api/email/unsubscribe', 'Actions/UnsubscribeAction').name('email.unsubscribe')
route.get('/users/{id}/posts/{postId}', handler).name('user.post')

// Generate URLs
url('email.unsubscribe', { token: 'abc-123' })
// => https://stacksjs.com/api/email/unsubscribe?token=abc-123

url('user.post', { id: 42, postId: 7 })
// => https://stacksjs.com/users/42/posts/7
```

Path parameters (`{id}`) are substituted; remaining params become query string. Uses `APP_URL` env var as base (defaults to `https://localhost`).

## Action Resolution

String-based route handlers are resolved at runtime:

1. **Actions** (`'Actions/MyAction'`): checks `app/Actions/MyAction.ts` first, falls back to `storage/framework/defaults/app/Actions/MyAction.ts`
2. **ORM Actions** (`'Actions/UserIndexOrmAction'`): loaded from `storage/framework/actions/src/`
3. **Controllers** (`'Controllers/MyController@method'`): checks `app/Controllers/` first, falls back to defaults

Action modules must export a default object with a `handle(req: EnhancedRequest)` method:

```typescript
// app/Actions/MyAction.ts
export default {
  handle(request: EnhancedRequest): Response {
    const name = request.get('name', 'world')
    return Response.json({ message: `Hello ${name}` })
  }
}
```

Actions can also define `validations` for automatic input validation:

```typescript
export default {
  validations: {
    email: {
      rule: { validate: (value) => ({ valid: typeof value === 'string' && value.includes('@') }) },
      message: 'A valid email is required',
    },
  },
  handle(request: EnhancedRequest): Response {
    // Request is validated before reaching handle()
    return Response.json({ success: true })
  },
}
```

Validation failures return a `422` response:
```json
{ "error": "Validation failed", "errors": { "email": ["A valid email is required"] } }
```

## Response Factory

```typescript
import { response } from '@stacksjs/router'

// JSON (200)
response.json({ message: 'OK' })
response.json(data, { status: 200, headers: { 'X-Custom': 'value' }, pretty: true })

// Status shortcuts
response.created({ id: 1 })              // 201
response.noContent()                      // 204
response.badRequest({ error: 'Bad' })     // 400
response.unauthorized()                   // 401 (default: { error: 'Unauthorized' })
response.forbidden()                      // 403 (default: { error: 'Forbidden' })
response.notFound()                       // 404 (default: { error: 'Not Found' })
response.error()                          // 500 (default: { error: 'Internal Server Error' })

// Other content types
response.text('Hello', { status: 200 })
response.html('<h1>Hello</h1>')
response.redirect('/new-url', 302)        // 301 | 302 | 303 | 307 | 308
```

All methods return a standard `Response` object.

## Enhanced Request (EnhancedRequest)

Route handlers receive an `EnhancedRequest` (extends `Request`) with Laravel-style helper methods:

```typescript
// Input access (merges query params + JSON body + form body + route params)
request.get<T>(key: string, defaultValue?: T): T
request.input<T>(key: string, defaultValue?: T): T
request.all(): Record<string, unknown>
request.only<T>(keys: string[]): T
request.except<T>(keys: string[]): T

// Presence checks
request.has(key: string | string[]): boolean
request.hasAny(keys: string[]): boolean
request.filled(key: string | string[]): boolean
request.missing(key: string | string[]): boolean

// Typed getters
request.string(key: string, defaultValue?: string): string
request.integer(key: string, defaultValue?: number): number
request.float(key: string, defaultValue?: number): number
request.boolean(key: string, defaultValue?: boolean): boolean
request.array<T>(key: string): T[]

// File handling (returns UploadedFile with store/storeAs methods)
request.file(key: string): UploadedFile | null
request.getFiles(key: string): UploadedFile[]
request.hasFile(key: string): boolean
request.allFiles(): Record<string, UploadedFile | UploadedFile[]>

// Authentication (set by auth middleware)
await request.user(): Promise<any>
await request.userToken(): Promise<any>
await request.tokenCan(ability: string): Promise<boolean>
await request.tokenCant(ability: string): Promise<boolean>
request.bearerToken(): string | null
```

## Request Context (AsyncLocalStorage)

Access the current request from anywhere using the `request` proxy:

```typescript
import { request, getCurrentRequest, runWithRequest, setCurrentRequest } from '@stacksjs/router'

// The `request` export is a Proxy that reads from AsyncLocalStorage
const token = request.bearerToken()
const user = await request.user()

// Manually run code in a request context
runWithRequest(enhancedReq, () => {
  // request proxy works here
})
```

## Middleware

### Defining Middleware

```typescript
// app/Middleware/Auth.ts
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Auth',
  priority: 1,        // Lower numbers run first (default: 10)
  async handle(request) {
    const token = request.bearerToken()
    if (!token) {
      const error = new Error('Unauthorized') as Error & { statusCode: number }
      error.statusCode = 401
      throw error
    }
    // Set authenticated user on request
    ;(request as any)._authenticatedUser = user
  },
})
```

### Middleware Alias Map

Define shorthand names in `app/Middleware.ts`:

```typescript
export default {
  auth: 'Auth',                     // maps to app/Middleware/Auth.ts
  verified: 'EnsureEmailIsVerified',
  abilities: 'CheckAbilities',      // supports params: 'abilities:read,write'
}
```

### Middleware Resolution Order
1. Parse alias via `app/Middleware.ts` (e.g., `'auth'` -> `'Auth'`)
2. Load from `app/Middleware/Auth.ts` (user override)
3. Fall back to `storage/framework/defaults/app/Middleware/Auth.ts`

### Middleware with Parameters

```typescript
route.get('/admin', handler).middleware('abilities:admin,write')
// Params accessible in middleware via: (request as any)._middlewareParams.abilities === 'admin,write'
```

## Fetcher (HTTP Client)

A fluent HTTP client for making API requests:

```typescript
import { fetcher } from '@stacksjs/api'

// GET request
const res = await fetcher.get<UserResponse>('/api/users')
res.data       // UserResponse
res.status     // 200
res.isOk       // true
res.ok()       // true (status === 200)
res.notFound() // false

// POST with JSON body
const res = await fetcher
  .withBody({ name: 'John', email: 'john@example.com' })
  .post<User>('/api/users')

// PUT/PATCH/DELETE
await fetcher.withBody(data).put<User>('/api/users/1')
await fetcher.withBody(data).patch<User>('/api/users/1')
await fetcher.delete('/api/users/1')

// Query parameters
await fetcher.withQueryParams({ page: 1, limit: 25 }).get('/api/users')

// Custom headers
await fetcher.withHeaders({ 'X-Custom': 'value' }).get('/api/users')

// Authentication
await fetcher.withToken('bearer-token-here').get('/api/me')
await fetcher.withBasicAuth('user', 'pass').get('/api/protected')
await fetcher.withDigestAuth('user', 'pass').get('/api/digest-protected')

// Form data
await fetcher.asForm().withBody({ email: 'test@test.com' }).post('/subscribe')

// File uploads (multipart/form-data)
await fetcher
  .attach('avatar', file, 'photo.jpg')
  .withBody({ name: 'John' })
  .post('/api/upload')

// Accept header
await fetcher.acceptJson().get('/api/data')
await fetcher.accept('text/xml').get('/api/feed')
```

### FetcherResponse<T>

```typescript
interface FetcherResponse<T = any> {
  data: T
  status: number
  headers: Headers
  isOk: boolean

  // Status checkers
  ok(): boolean             // 200
  created(): boolean        // 201
  accepted(): boolean       // 202
  noContent(): boolean      // 204
  movedPermanently(): boolean  // 301
  found(): boolean          // 302
  badRequest(): boolean     // 400
  unauthorized(): boolean   // 401
  paymentRequired(): boolean   // 402
  forbidden(): boolean      // 403
  notFound(): boolean       // 404
  requestTimeout(): boolean    // 408
  conflict(): boolean       // 409
  unprocessableEntity(): boolean // 422
  tooManyRequests(): boolean   // 429
  serverError(): boolean    // 500
}
```

### Fetcher Types

```typescript
type QueryParams = Record<string, string | number | boolean | null | undefined>
type BodyData = Record<string, any>

interface FileAttachment {
  name: string
  content: Blob
  filename?: string
  headers?: Record<string, string>
}
```

## API Resources (Laravel-style)

### JsonResource

Transform models into JSON responses with conditional field inclusion:

```typescript
import { JsonResource } from '@stacksjs/api'

class UserResource extends JsonResource<User> {
  toArray() {
    return {
      id: this.resource.id,
      name: this.resource.name,
      email: this.resource.email,
      // Conditional inclusion
      secret: this.when(isAdmin, this.resource.secret),
      avatar: this.whenNotNull(this.resource.avatar),
      // Relationship loading
      posts: this.whenLoaded('posts', () => PostResource.collection(this.resource.posts)),
      posts_count: this.whenCounted('posts'),
      // Conditional merge
      ...this.mergeWhen(isAdmin, { admin_notes: this.resource.adminNotes }),
    }
  }
}

// Single resource
const response = new UserResource(user).toResponse()
// => { data: { id: 1, name: 'John', email: 'john@...' } }

// With additional data
new UserResource(user).withAdditional({ meta: { version: 1 } }).toResponse()

// JSON string
new UserResource(user).toJson()
```

### JsonResource Methods

```typescript
abstract class JsonResource<T> {
  resource: T
  additional: Record<string, any>
  static wrap: string | null = 'data'  // Wrap key, null to disable

  abstract toArray(request?: Request): Record<string, any>

  // Instance methods
  withRequest(request: Request): this
  withAdditional(data: Record<string, any>): this
  resolve(request?: Request): Record<string, any>
  toResponse(request?: Request): Record<string, any>
  toJson(request?: Request): string

  // Static methods
  static collection<T, R>(resources: T[]): ResourceCollection<T, R>
  static withoutWrapping(): void     // Set wrap = null for this class
  static wrapWith(key: string): void // Set custom wrap key

  // Conditional helpers (protected, use inside toArray)
  protected when<V>(condition: boolean | (() => boolean), value: V | (() => V), defaultValue?: any): V | MissingValue
  protected whenNotNull<V>(value: V | null | undefined, transform?: (v: V) => any): any | MissingValue
  protected whenLoaded<V>(relationship: string, value?: V | (() => V), defaultValue?: any): V | any[] | MissingValue
  protected whenCounted(relationship: string, defaultValue?: number): number | MissingValue
  protected merge(data: Record<string, any>): MergeValue
  protected mergeWhen(condition: boolean | (() => boolean), data: Record<string, any> | (() => Record<string, any>)): MergeValue | MissingValue
}
```

### ResourceCollection

```typescript
class ResourceCollection<T, R extends JsonResource<T>> {
  resources: T[]
  static wrap: string | null = 'data'

  withRequest(request: Request): this
  withAdditional(data: Record<string, any>): this
  resolve(request?: Request): Record<string, any>[]
  toResponse(request?: Request): Record<string, any>
  toJson(request?: Request): string
  count(): number
  isEmpty(): boolean
  isNotEmpty(): boolean
}

// Usage
const collection = UserResource.collection(users)
collection.toResponse()
// => { data: [{ id: 1, ... }, { id: 2, ... }] }
```

### PaginatedResourceCollection

```typescript
class PaginatedResourceCollection<T, R extends JsonResource<T>> extends ResourceCollection<T, R> {
  meta: PaginationMeta
  links: PaginationLinks

  // Create from raw pagination data
  static fromPagination<T, R>(
    data: T[],
    ResourceClass: new (resource: T) => R,
    options: { currentPage: number, perPage: number, total: number, baseUrl?: string },
  ): PaginatedResourceCollection<T, R>

  toResponse(): Record<string, any>
  // => { data: [...], meta: { current_page, from, last_page, per_page, to, total }, links: { first, last, prev, next } }
}

interface PaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  per_page: number
  to: number | null
  total: number
}

interface PaginationLinks {
  first: string | null
  last: string | null
  prev: string | null
  next: string | null
}
```

### Anonymous Resources

Quick inline transformations without defining a class:

```typescript
import { resource, collection } from '@stacksjs/api'

// Single resource
resource(user, (u) => ({ id: u.id, name: u.name })).toResponse()
// => { data: { id: 1, name: 'John' } }

// Collection
collection(users, (u) => ({ id: u.id, name: u.name })).toResponse()
// => { data: [{ id: 1, name: 'John' }, ...] }
```

### Conditional Value Types

```typescript
class MissingValue {
  static instance: MissingValue
  isMissing(): boolean
}

class MergeValue {
  constructor(data: Record<string, any>)
}

class ConditionalValue {
  constructor(condition: boolean | (() => boolean), value: any, defaultValue?: any)
  resolve(): any
}
```

`MissingValue` entries are stripped from the final output by `filterAndResolve()` (max depth: 20).

## OpenAPI Generation

```typescript
import { generateOpenApi } from '@stacksjs/api'

await generateOpenApi()
// Reads all registered routes via `route.routes()`
// Writes OpenAPI 3.0 spec to storage/framework/api/openapi.json
```

The generated spec includes:
- Path definitions from route URLs
- HTTP methods from route registrations
- Path parameters extracted from `{param}` placeholders
- Response/request schemas if defined on routes (`route.responseSchema`, `route.requestSchema`)
- Operation IDs from route callbacks (action paths)

TypeScript types can be generated from the spec:
```bash
# Defined in package.json scripts
bun run generate-types
# Runs: open-api ./../../api/openapi.json --output ./../../api/api-types.ts
```

## Error Handling

### Error Response Structure

```typescript
interface ErrorResponseBody {
  error: string
  message: string
  status: number
  timestamp: string
  details?: Record<string, unknown>
}
```

### Development vs Production
- **Development**: Ignition-style HTML error pages with full stack traces, database queries, and request context
- **Production**: Simple JSON or HTML error responses (no stack traces)
- Detection: `APP_ENV !== 'production' && NODE_ENV !== 'production'`
- API requests (Accept: `application/json`): always get JSON error responses

### Error Functions

```typescript
import {
  createErrorResponse,
  createMiddlewareErrorResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
  trackQuery,
  clearTrackedQueries,
} from '@stacksjs/router'

// Track queries for error context (circular buffer, max 50)
trackQuery('SELECT * FROM users', 12.5, 'sqlite')

// Create error responses
await createErrorResponse(error, request, { status: 500, handlerPath: 'Actions/MyAction' })
await createMiddlewareErrorResponse(error, request)  // Uses error.statusCode
createValidationErrorResponse({ email: ['Required'] }, request)  // 422
await createNotFoundResponse('/missing-path', request)  // 404
```

### Sensitive Data Sanitization
Error pages automatically redact fields matching these patterns: `password`, `secret`, `token`, `api_key`, `authorization`, `credential`, `cookie`, `session_id`, and others.

## Port Configuration (config/ports.ts)

```typescript
{
  frontend: env.PORT ?? 3000,
  backend: env.PORT_BACKEND ?? 3001,
  admin: env.PORT_ADMIN ?? 3002,
  api: env.PORT_API ?? 3008,
  // ... other services
}
```

## Route Groups in routes/api.ts

The main `routes/api.ts` file defines route groups for major feature areas:

| Prefix | Feature | Actions Prefix |
|--------|---------|---------------|
| `/auth` | Authentication & tokens | `Actions/Auth/` |
| `/password` | Password reset flow | `Actions/Password/` |
| `/payments` | Stripe payment integration | `Actions/Payment/` |
| `/commerce` | E-commerce (products, orders, customers, coupons, gift cards, tax rates, reviews, receipts, POS, waitlists) | `Actions/Commerce/` |
| `/shipping` | Shipping methods, rates, zones, delivery routes, drivers, digital delivery, license keys | `Actions/Commerce/Shipping/` |
| `/cms` | Blog posts, authors, categories, tags, comments, pages | `Actions/Cms/` |
| `/blog` | Public blog endpoints (read-only) | `Actions/Cms/` |
| `/monitoring` | Error tracking & resolution | `Actions/Monitoring/` |
| `/dashboard` | Dashboard stats & health | `Actions/Dashboard/` |
| `/queries` | Query log dashboard | `Controllers/QueryController@` |
| `/queues` | Queue management | `Actions/Queue/` |
| `/realtime` | WebSocket management | `Actions/Realtime/` |
| `/voide` | Voice AI code assistant | `Actions/Buddy/` |

## ORM-Generated CRUD Routes

Models with `traits.useApi` automatically get CRUD routes via ORM actions:

| Method | Path | Action | Status |
|--------|------|--------|--------|
| GET | `/api/{model}` | `{Model}IndexOrmAction` | 200 |
| POST | `/api/{model}` | `{Model}StoreOrmAction` | 201 |
| GET | `/api/{model}/{id}` | `{Model}ShowOrmAction` | 200 |
| PATCH | `/api/{model}/{id}` | `{Model}UpdateOrmAction` | 202 |
| DELETE | `/api/{model}/{id}` | `{Model}DestroyOrmAction` | 204 |

## CLI Commands

- `buddy dev` -- starts the API server with hot-reload
- `buddy generate:api-types` -- regenerates API TypeScript types from OpenAPI spec

## Gotchas

- The `fetcher` is a **singleton instance** -- state (headers, body, query params) is reset after each request via `resetState()`, but calling chain methods without executing a request will accumulate state
- `fetcher.withDigestAuth()` uses SHA-256 internally despite the method name `generateMD5` -- this is a misnomer in the source code
- `fetcher` always parses responses as JSON (`response.json()`) -- it will throw if the response is not valid JSON
- Route files named `api` or `web` are loaded at root `/` with no prefix; all other route file keys auto-prefix with `/<key>`
- The `route` object is a global singleton from `stacks-router.ts` -- all route definitions across files share the same router instance
- String-based handlers (`'Actions/MyAction'`) are resolved lazily at request time, not at registration time -- import errors surface only when the route is hit
- Actions must export `default` with a `handle()` method; Controllers must export `default` as a class with the specified method (defaults to `index`)
- The `request` proxy from `@stacksjs/router` returns safe defaults (null, undefined, empty) when accessed outside of a request context -- it warns in non-production
- `JsonResource.filterAndResolve()` has a max recursion depth of 20 to prevent stack overflow on circular references
- `ResourceCollection.toResponse()` and `JsonResource.toResponse()` both wrap data in `{ data: ... }` by default -- call `MyResource.withoutWrapping()` to disable
- The error handler tracks up to 50 recent queries in a circular buffer -- these are cleared after each successful response
- Middleware runs in registration order (not by priority) within a single route -- the `priority` field on `Middleware` is for documentation/ordering within files
- Middleware parameters (e.g., `'abilities:read,write'`) are stored on `request._middlewareParams` -- middleware must parse the param string itself
- The dev server's file watchers use Node's `fs.watch` (not `chokidar`) -- on macOS this uses FSEvents, on Linux it uses inotify
- `openapi.json` starts empty (`{}`) and is only populated when `generateOpenApi()` is explicitly called
- The `api-types.ts` file uses operations keyed by action path (e.g., `'Actions/UserIndexOrmAction'`), not by route name
- CORS headers (`Access-Control-Allow-Origin: http://localhost:5173`) are only added in development mode for error responses
- Body parsing happens once per request (tracked via `_bodyParsed` flag) -- JSON, URL-encoded, and multipart/form-data are all supported
- `response.json()` catches circular reference errors and returns `{ error: 'Response data could not be serialized' }` instead of throwing
