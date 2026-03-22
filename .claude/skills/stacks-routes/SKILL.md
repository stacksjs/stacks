---
name: stacks-routes
description: Use when defining or organizing route files in a Stacks application — creating route files in routes/, registering them in app/Routes.ts, using route prefixes and middleware groups, or the default API routes structure. For the router API itself (request helpers, response helpers, middleware classes), see stacks-router.
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
  'api': 'api',                                    // routes/api.ts → no prefix
  'v1': { path: 'v1', prefix: 'v1' },            // routes/v1.ts → /v1/*
  'admin': { path: 'admin', prefix: 'admin', middleware: ['auth'] }
} satisfies Record<string, string | RouteDefinition>
```

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

## Default API Routes (routes/api.ts)

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
- Route files must be registered in `app/Routes.ts` to be loaded
- String handlers (Actions/X) are dynamically imported at request time
- Route order matters — first match wins
- Use groups for shared middleware instead of repeating on each route
- The `health()` helper registers `GET /health` automatically
- For the router API (request helpers, middleware, responses), see the `stacks-router` skill
