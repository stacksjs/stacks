---
name: stacks-routes
description: Use when defining or organizing route files in a Stacks application - creating route files in routes/, registering them in app/Routes.ts, using route prefixes and middleware groups, or the default API routes structure. For the router API itself (request helpers, response helpers, middleware classes), see stacks-router.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Route Definitions

How to define and organize routes in a Stacks application.

## Key Paths
- Route files: `routes/` (api.ts, v1.ts, buddy.ts, users.ts)
- Route registry: `app/Routes.ts`

## Route Registry (app/Routes.ts)

Maps route files to URL prefixes:
```typescript
export default {
  'api': 'api',                                    // routes/api.ts → /api/* (auto-prefixed; see #1835)
  'v1': { path: 'v1', prefix: 'v1' },            // routes/v1.ts → /v1/*
  'admin': { path: 'admin', prefix: 'admin', middleware: ['auth'] }
} satisfies Record<string, string | RouteDefinition>
```

`app/Routes.ts` is optional. Without a usable registry, `appRouteRegistry()`
falls back to `{ api: 'api' }`. Keys supply the default prefix; `web` is
root-mounted, and an explicit empty prefix mounts a route file at the root.
Route files define paths relative to that prefix, so `/api` should not be
repeated inside `routes/api.ts`.

App route files load before framework bundles. Duplicate method/path
registrations keep the first one, allowing an app route to override a default.
Discovered packages can contribute route files and other resource roots;
their registration does not automatically make components globally available.
See `stacks-config` for package discovery.

## Creating a Route File

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

route.get('/users', 'Actions/ListUsers')
route.post('/users', 'Actions/CreateUser')
route.get('/users/{id}', 'Actions/ShowUser')
route.put('/users/{id}', 'Actions/UpdateUser')
route.delete('/users/{id}', 'Actions/DeleteUser')

// With inline handler
route.get('/health', (req) => Response.json({ status: 'ok' }))

// Groups
route.group({ prefix: '/admin', middleware: ['auth'] }, () => {
  route.get('/dashboard', 'Actions/Dashboard')
  route.get('/settings', 'Actions/Settings')
})

// Health check
route.health()
```

## Default route bundles

Default bundles are selected by `STACKS_DEFAULT_ROUTES`, the route loader,
and the relevant feature gates. The following endpoint families are discovery
examples, not a guarantee they are mounted in every app. In particular,
enabling auth models is separate from exposing the default authentication
routes. Use `buddy route:list` to inspect this application's actual surface.

### Authentication
- `POST /login` → LoginAction
- `POST /register` → RegisterAction
- `POST /auth/refresh` → RefreshTokenAction
- `GET /me` → GetMeAction (auth)
- `POST /logout` → LogoutAction (auth)

### Email
- `POST /api/email/subscribe`
- `GET /api/email/unsubscribe`

### AI
- `POST /ai/ask`, `POST /ai/summary`

### CMS & Commerce
- `/cms/posts/*`, `/cms/authors/*`, `/cms/categories/*`, `/cms/tags/*`
- `/commerce/products/*`, `/commerce/orders/*`, `/commerce/customers/*`

### Health
- `GET /health` — status, uptime, memory, PID, Bun version

## Versioned Routes (routes/v1.ts)

```typescript
// routes/v1.ts — prefixed with /v1
route.get('/users', 'Actions/V1/ListUsers')
```

## Handler Types

```typescript
// 1. Action string (auto-loaded from app/Actions/)
route.get('/users', 'Actions/ListUsers')

// 2. Controller method
route.get('/users', 'Controllers/UserController@index')

// 3. Inline function
route.get('/ping', (req) => Response.json({ pong: true }))
```

## CLI Commands
- `buddy route:list` — list all registered routes

## Gotchas
- Additional route files need registration; the optional manifest's fallback
  already mounts `routes/api.ts` at `/api`.
- String handlers (Actions/X) are dynamically imported at request time
- Route order matters — first match wins
- Use groups for shared middleware instead of repeating on each route
- The `health()` helper registers `GET /health` automatically
- For the router API (request helpers, middleware, responses), see the `stacks-router` skill

Source: `core/router/src/route-loader.ts`, `appRouteRegistry`, and
`app-route-registry`, `route-bundles-mounted`, `default-route-bundles`,
`duplicate-route-registration`, and package-discovery tests.
