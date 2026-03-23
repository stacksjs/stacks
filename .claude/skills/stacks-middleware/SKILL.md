---
name: stacks-middleware
description: Use when working with middleware in a Stacks application — defining middleware, applying to routes, middleware aliases, parameterized middleware, groups, or the middleware execution pipeline. Covers the Middleware class, app/Middleware.ts alias registry, and all 22 default middleware files.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Middleware

Built into `@stacksjs/router`. Middleware intercepts requests before they reach route handlers.

## Key Paths
- Middleware class: `storage/framework/core/router/src/middleware.ts`
- Execution engine: `storage/framework/core/router/src/stacks-router.ts`
- Alias registry: `app/Middleware.ts`
- Default middleware: `storage/framework/defaults/app/Middleware/` (22 files)
- Auth middleware (standalone): `storage/framework/core/auth/src/middleware.ts`
- Tests: `storage/framework/core/router/tests/middleware.test.ts`

## Middleware Class

```typescript
import { Middleware } from '@stacksjs/router'

export interface MiddlewareConfig {
  name: string
  priority?: number  // Lower = runs first, default: 10
  handle: (request: EnhancedRequest) => void | Promise<void>
}

export class Middleware {
  readonly name: string
  readonly priority: number
  readonly handle: (request: EnhancedRequest) => void | Promise<void>

  constructor(config: MiddlewareConfig)
}
```

## Creating Custom Middleware

Create a file in `app/Middleware/`:

```typescript
// app/Middleware/RateLimit.ts
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'RateLimit',
  priority: 2,
  async handle(request) {
    // Throw to short-circuit the request
    // throw new HttpError(429, 'Too many requests')

    // Return void to continue to next middleware
  },
})
```

### Short-Circuiting

Middleware can stop request processing by:
1. **Throwing an Error with `statusCode`** — converted to HTTP error response
2. **Throwing a Response** — returned directly to client
3. **Returning void** — continues to next middleware

```typescript
// Error with status code
const error = new Error('Unauthorized') as Error & { statusCode: number }
error.statusCode = 401
throw error

// Direct Response (full control)
throw new Response(JSON.stringify({ error: 'Rate limited' }), {
  status: 429,
  headers: { 'Retry-After': '60' },
})
```

## Alias Registry (app/Middleware.ts)

Maps short names to middleware class filenames:

```typescript
export default {
  'maintenance': 'Maintenance',
  'auth': 'Auth',
  'guest': 'Guest',
  'api': 'Api',
  'team': 'Team',
  'logger': 'Logger',
  'abilities': 'Abilities',
  'can': 'Can',
  'throttle': 'Throttle',
  'env': 'Env',
  'env:local': 'EnvLocal',
  'env:development': 'EnvDevelopment',
  'env:dev': 'EnvDevelopment',
  'env:staging': 'EnvStaging',
  'env:production': 'EnvProduction',
  'env:prod': 'EnvProduction',
  'role': 'Role',
  'permission': 'Permission',
  'verified': 'EnsureEmailIsVerified',
} satisfies Middleware
```

## Applying Middleware

### Per-Route (Chainable)
```typescript
route.get('/dashboard', 'DashboardAction')
  .middleware('auth')
  .middleware('verified')
  .name('dashboard.show')
```

### Route Groups
```typescript
route.group({ prefix: '/api/v1', middleware: ['auth', 'throttle'] }, () => {
  route.get('/users', listUsers)
  route.post('/users', createUser)
})
```

Group middleware is prepended to all routes inside the callback. Groups can be nested — middleware accumulates.

### Parameterized Middleware

Pass parameters using colon syntax:

```typescript
route.get('/admin', handler).middleware('throttle:60,1')     // 60 requests per 1 minute
route.get('/posts', handler).middleware('abilities:read,write')
route.get('/settings', handler).middleware('role:admin,editor')
route.get('/posts/{id}', handler).middleware('can:update,post')
```

Parameters are stored on `request._middlewareParams[middlewareName]` and parsed by the middleware's `handle` function.

## Default Middleware Reference

| Alias | Class | Priority | Description |
|-------|-------|----------|-------------|
| `maintenance` | Maintenance | 0 | Checks maintenance mode, supports secret bypass URL and IP allowlist |
| `auth` | Auth | 1 | Validates bearer token, sets authenticated user on request |
| `api` | Api | 1 | Validates request accepts JSON |
| `guest` | Guest | 1 | Ensures user is NOT authenticated (for login/register pages) |
| `env` | Env | 1 | Checks current environment |
| `logger` | Logger | 2 | Logs request method and URL |
| `abilities` | Abilities | 2 | Checks token abilities/scopes (parameterized: `abilities:read,write`) |
| `can` | Can | 3 | Authorization gate (parameterized: `can:update,post`) |
| `role` | Role | 3 | Checks user roles (parameterized: `role:admin`) |
| `permission` | Permission | 3 | Checks user permissions (parameterized: `permission:edit-posts`) |
| `team` | Team | 3 | Ensures user belongs to a team (parameterized: `team:teamId`) |
| `verified` | EnsureEmailIsVerified | 4 | Verifies email is confirmed |
| `throttle` | Throttle | — | Rate limiting (parameterized: `throttle:60,1` or `throttle:100,5m`) |
| `env:local` | EnvLocal | — | Only allows local environment |
| `env:development` / `env:dev` | EnvDevelopment | — | Only allows development |
| `env:staging` | EnvStaging | — | Only allows staging |
| `env:production` / `env:prod` | EnvProduction | — | Only allows production |

### Environment Negation Variants

Files exist for `EnvNotLocal`, `EnvNotDevelopment`, `EnvNotStaging`, `EnvNotProduction` — but they have **no aliases registered** in `app/Middleware.ts`.

## Middleware Loading Flow

```
1. Parse middleware name: 'throttle:60,1' → { name: 'throttle', params: '60,1' }
2. Check middleware cache (loaded once, cached for performance)
3. Resolve alias: 'throttle' → 'Throttle' (via app/Middleware.ts)
4. Try loading from app/Middleware/Throttle.ts (user overrides)
5. Fall back to storage/framework/defaults/app/Middleware/Throttle.ts
6. Store params on request: request._middlewareParams.throttle = '60,1'
7. Execute: await middleware.handle(enhancedRequest)
```

User middleware in `app/Middleware/` always takes precedence over framework defaults.

## Representative Implementations

### Auth Middleware
```typescript
export default new Middleware({
  name: 'Auth',
  priority: 1,
  async handle(request) {
    const bearerToken = request.bearerToken()
    if (!bearerToken)
      throw new HttpError(401, 'Unauthorized. No token provided.')
    const isValid = await Auth.validateToken(bearerToken)
    if (!isValid)
      throw new HttpError(401, 'Unauthorized. Invalid token.')
  },
})
```

### Maintenance Middleware
```typescript
export default new Middleware({
  name: 'Maintenance',
  priority: 0,
  async handle(request) {
    if (!(await isDownForMaintenance())) return
    const payload = await maintenancePayload()
    // Check secret bypass URL → set cookie and redirect
    // Check bypass cookie or allowed IP → continue
    // Otherwise → throw maintenance response
  },
})
```

### Throttle Middleware (Parameterized)
```typescript
// '60,1' = 60 requests per 1 minute
// '100,5m' = 100 requests per 5 minutes
// '1000,1h' = 1000 requests per hour
async handle(request) {
  const params = request._middlewareParams?.throttle || '60,1'
  const config = parseThrottleString(params)
  const limiter = createRateLimitMiddleware(config)
  // Returns 429 if rate limit exceeded
}
```

## Standalone Auth Middleware (@stacksjs/auth)

A separate, more complete auth middleware exists:

```typescript
import { authMiddleware, authMiddlewareHandler } from '@stacksjs/auth'

// Checks both request.bearerToken() and raw Authorization header
// Calls Auth.getUserFromToken() to validate
// Sets Auth.setUser(user) and request._authenticatedUser
// Loads current access token onto request._currentAccessToken
```

## Gotchas
- **Priority exists but isn't used for ordering** — the router executes middleware in registration order, not priority order
- **`terminate()` doesn't exist** — some docs reference it, but it's not in the actual `MiddlewareConfig` interface
- **Two auth middleware implementations** — defaults version (basic token check) and `@stacksjs/auth` version (full user loading)
- **EnvNot* files have no aliases** — `EnvNotLocal.ts`, etc. exist but aren't registered in `app/Middleware.ts`
- **Middleware is cached after first load** — changes require server restart
- **User overrides take precedence** — `app/Middleware/Auth.ts` replaces the framework default completely
- **Group middleware accumulates** — nested groups combine all parent middleware
- **Request body parsed before middleware** — Laravel-style methods (`.input()`, `.query`, `.file()`) are available in middleware
