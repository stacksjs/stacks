---
name: stacks-router
description: Use when working with routing in a Stacks application - defining routes, HTTP methods, route groups, middleware, named routes, URL generation, request enhancement (Laravel-style input/query/file helpers), response helpers, error responses, route model binding, or rate limiting. Covers @stacksjs/router, routes/, and app/Routes.ts.
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
- Generated route manifest: `storage/framework/stx/routes.ts` (written by the dev server)
- Derived name types: `storage/framework/types/registries.d.ts`
- The maps they read: `storage/framework/auto-imports/{actions,listeners,policies,middleware,emails,routes}.ts`

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
- Function: `(req) => …` — return a `Response`, or any value `formatResult`
  handles: an object/array becomes JSON, a string becomes text, `null` becomes
  204, a `ReadableStream` streams. `req.params` is narrowed to the path's own
  placeholders, so `req.params.slugTypo` is a compile error rather than
  `undefined` at runtime.
- Action string: `'Actions/CreateUser'` — auto-loads action, lazily
- Action object: an imported action, passed directly — see typed routes below
- Controller: `'Controllers/UserController@index'` — calls controller method

## The strings are typed

Action paths, middleware aliases and route names are all checked at compile
time against what this application actually has, and nothing is maintained by
hand - or generated as a type.

Each of them is `keyof` over a map the RESOLVER reads:
`storage/framework/auto-imports/{actions,middleware,routes}.ts`, name to file,
written by `buddy generate` alongside the models and jobs barrels. So a name
that type-checks is a name that resolves; there is no second list to go stale.
`storage/framework/types/registries.d.ts` is where the derivation lives.

Middleware aliases need no map at all - `app/Middleware.ts` and the framework's
own are ordinary modules, and `defineMiddleware` keeps their literal keys.

```typescript
route.get('/login', 'Actions/Auth/LogniAction')   // ✗ no such action
route.get('/admin', handler).middleware('atuh')   // ✗ no such middleware alias
url('email.unsubscrbe', { token })                // ✗ no such route name
url('user.post', { id: 42 })                      // params come from the path
```

The middleware one is the one that matters most: a typo'd alias used to serve
the route **without** the protection, silently.

Notes:
- Controllers stay a pattern (`'Controllers/X@method'`) — the method half is a
  member name, not a filename.
- Negated (`'!auth'`) and parameterised (`'throttle:60,1'`) middleware forms are
  both accepted.
- The maps refresh on `buddy generate`, `buddy generate:types` and dev-server
  boot, and the staleness check watches the directories they are built from. A
  map written before a file was added rejects code that is correct.
- `resource()` takes a BASE, and composes `Actions/<Base><Kind>Action` from it.
  `route.resource('posts', 'Post')` → `Actions/PostIndexAction`, matching where
  `buddy make:crud` writes. The base is checked against the actions that exist;
  which of the five siblings you need depends on `only`/`except`, so that part
  is settled when the route is hit.

### Path params arrive decoded

`/users/{name}` given `/users/caf%C3%A9` hands the handler `café`, and `%2F`
becomes a real `/`. Decoded exactly once, in bun-router — do NOT decode again in
an action or middleware: two passes turn `%2520` into a space, which is how a
filter that rejects `../` gets walked past. A malformed escape (`%ZZ`) passes
through raw rather than failing the request.

A decoded param can contain `/`, so anything joining one into a filesystem path
still has to sanitise. Decoding makes the value correct, not safe.

## Typed Routes (zero generation)

`route.get('/x', 'Actions/Foo')` resolves its action by a dynamic `import()` of a
string. Good for the runtime — lazy, hot-reload friendly — and completely opaque
to the compiler, so no client can be typed from it without a generation step.

`createTypedRouter()` registers through the same router while accumulating a
route map into its own type:

```typescript
import IndexAction from '../app/Actions/Project/IndexAction'
import StoreAction from '../app/Actions/Project/StoreAction'
import { createTypedRouter } from '@stacksjs/router'

export const api = createTypedRouter()
  .get('/v1/projects', IndexAction)
  .post('/v1/projects', StoreAction, { middleware: 'auth', rateLimit: { max: 10 } })

export type AppRoutes = typeof api
```

Any TypeScript consumer then gets full inference with **no CLI step**:

```typescript
import { createTypedClient } from '@stacksjs/router'

const client = createTypedClient<AppRoutes>({ baseUrl })
const projects = await client.get('/v1/projects')   // typed from the action
```

Facts worth knowing before using it:

- **One runtime path.** A directly-registered action goes through the same
  `wrapAction` as a string-registered one — validation, `authorize`, `before`,
  `formatResult`, error reporting. Only the compile-time story differs.
- **Input from `validations`, output from `handle`'s return type.** An action
  returning a `Response` is typed `unknown`; it took over the wire format.
- **Options are an argument**, not chained — chaining would return the route and
  lose the accumulated type.
- **No `.group()`.** A runtime-only prefix makes every path type wrong; a
  type-only prefix is a second place for the URL to live.
- **Both forms feed OpenAPI.** Directly-registered actions are reported by
  `listRegisteredRoutes()`, so the generator reads their schema with no file
  path to import.
- The builder, the client and the contract live in `@stacksjs/bun-router` and
  are re-exported here. See the `stacks-api` skill for the full client story.

## Route Registry (app/Routes.ts)

```typescript
export default {
  'api': 'api',                              // routes/api.ts → /api/* (auto-prefixed; see #1835)
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
- The dev server writes a route manifest to `storage/framework/stx/routes.ts` (stx's `stateDir`, set in `config/ui.ts`); it is a build artifact, not a file to edit
- The health endpoint returns uptime, memory, PID, and Bun version info
