---
name: stacks-router
description: Use when working with routing in a Stacks application — defining routes, HTTP methods, route groups, middleware, named routes, URL generation, request enhancement (Laravel-style input/query/file helpers), response helpers, error responses, route model binding, or rate limiting. Covers @stacksjs/router, routes/, and app/Routes.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Router

Built on `@stacksjs/bun-router` with `ts-rate-limiter`.

## Key Paths
- Core package: `storage/framework/core/router/src/`
- Route files: `routes/` (api.ts, v1.ts, buddy.ts, users.ts)
- Route registry: `app/Routes.ts`
- Router types: `storage/framework/types/router.d.ts`
- Dashboard types: `storage/framework/types/dashboard-router.d.ts`

## Route Definition

```typescript
import { route } from '@stacksjs/router'

route.get('/users', handler)
route.post('/users', handler)
route.put('/users/{id}', handler)
route.patch('/users/{id}', handler)
route.delete('/users/{id}', handler)
route.options('/users', handler)
route.health()  // GET /health endpoint
```

### Chainable Methods
```typescript
route.get('/admin', handler)
  .middleware('auth')
  .name('admin.dashboard')
```

### Route Groups
```typescript
route.group({ prefix: '/api/v1', middleware: ['auth', 'throttle'] }, () => {
  route.get('/users', listUsers)
  route.post('/users', createUser)
})
```

### Handler Types
- Function: `(req: EnhancedRequest) => Response | Promise<Response>`
- Action string: `'Actions/CreateUser'` — auto-loads action
- Controller: `'Controllers/UserController@index'` — calls controller method

## Route Registry (app/Routes.ts)

```typescript
export default {
  'api': 'api',                              // routes/api.ts → / (no prefix)
  'v1': { path: 'v1', prefix: 'v1' },       // routes/v1.ts → /v1/*
  'admin': { path: 'admin', prefix: 'admin', middleware: ['auth'] }
} satisfies Record<string, string | RouteDefinition>
```

## Enhanced Request (Laravel-style)

### Input Methods
```typescript
req.get('name', 'default')        // get input value
req.input('name', 'default')      // alias
req.all()                          // all input
req.only(['name', 'email'])       // specific fields
req.except(['password'])          // all except
req.has('name')                    // exists?
req.has(['name', 'email'])        // all exist?
req.hasAny(['name', 'email'])     // any exist?
req.filled('name')                // exists and not empty?
req.missing('name')               // doesn't exist?
req.query                         // query parameters object
```

### Type Conversion
```typescript
req.string('name', '')
req.integer('page', 1)
req.float('price', 0.0)
req.boolean('active', false)
req.array('tags')
```

### File Handling
```typescript
const file = req.file('avatar')          // UploadedFile | null
const files = req.getFiles('images')     // UploadedFile[]
req.hasFile('avatar')                    // boolean
const all = req.allFiles()               // Record<string, UploadedFile[]>
```

### Authentication
```typescript
const user = await req.user()
const token = await req.userToken()
await req.tokenCan('create-posts')
await req.tokenCant('delete-users')
```

## Response Helpers

```typescript
import { response } from '@stacksjs/router'

response.json(data, { status: 200 })
response.created(data)         // 201
response.noContent()           // 204
response.badRequest(data)      // 400
response.unauthorized()        // 401
response.forbidden()           // 403
response.notFound()            // 404
response.error()               // 500
response.redirect(url, 302)
response.text('hello')
response.html('<h1>Hi</h1>')
```

## Error Responses

```typescript
createErrorResponse(error, request, options?)
createMiddlewareErrorResponse(error, request)
createValidationErrorResponse(errors, request)
createNotFoundResponse(path, request)
```

Error response body:
```typescript
{ error: string, message: string, status: number, timestamp: string, details?: Record<string, unknown> }
```

## Request Context

```typescript
import { getCurrentRequest, setCurrentRequest, runWithRequest, request } from '@stacksjs/router'

// Async context management
const req = getCurrentRequest()
runWithRequest(req, async () => {
  // `request` proxy available here
})
```

## Middleware

```typescript
import { Middleware } from '@stacksjs/router'

const logger = new Middleware({
  name: 'logger',
  priority: 5,   // lower = runs first, default 10
  handle: async (request: EnhancedRequest) => {
    console.log(`${request.method} ${request.url}`)
  }
})

route.use(logger)
```

### Available Middleware Aliases (from app/Middleware.ts)
maintenance, auth, guest, api, team, logger, abilities, can, throttle, local, development, staging, production, env.local, env.development, env.staging, env.production, role, permission, verified

## Query Tracking

```typescript
trackQuery(query, time?, connection?)
clearTrackedQueries()
clearMiddlewareCache()
```

## Default API Routes (routes/api.ts)

### Auth
- `POST /login`, `POST /register`, `POST /auth/refresh`, `POST /auth/token`
- `GET /auth/tokens`, `DELETE /auth/tokens/{id}` (auth)
- `GET /me`, `POST /logout` (auth)

### Email
- `POST /api/email/subscribe`, `GET /api/email/unsubscribe`

### AI
- `POST /ai/ask`, `POST /ai/summary`

### CMS
- `/cms/posts/*`, `/cms/authors/*`, `/cms/categories/*`, `/cms/tags/*`, `/cms/comments/*`

### Commerce
- `/commerce/products/*`, `/commerce/orders/*`, `/commerce/customers/*`, `/shipping/*`

### Monitoring
- `/monitoring/errors/*`

### Health
- `GET /health` — returns status, uptime, memory, PID, Bun version

## Server Integration

```typescript
import { serve, serverResponse } from '@stacksjs/router'

await serve({ port: 3000 })
const response = await serverResponse(request)
```

## URL Generation

```typescript
import { url } from '@stacksjs/router'

url('admin.dashboard')                    // '/admin/dashboard'
url('user.show', { id: 42 })             // '/users/42'
```

## Gotchas
- Routes use `@stacksjs/bun-router` under the hood
- Rate limiting via `ts-rate-limiter` is built into the router
- Route registry in `app/Routes.ts` maps file names to URL prefixes
- String-based handlers (`'Actions/MyAction'`) are dynamically imported
- Middleware priority: lower number = runs first
- The `request` proxy uses AsyncLocalStorage for context — must be inside `runWithRequest()`
- EnhancedRequest extends the native Bun Request with Laravel-style helpers
- File uploads return `UploadedFile` objects with metadata
- Query tracking is for debug/profiling — call `clearTrackedQueries()` to free memory
- 136+ routes are auto-generated in `storage/framework/types/router.d.ts`
- The health endpoint returns uptime, memory, PID, and Bun version info
