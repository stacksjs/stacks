---
title: Middleware
description: Learn how to create and use middleware in Stacks applications
---

# Middleware

Middleware provides a mechanism for filtering and modifying HTTP requests entering your application. Common use cases include authentication, logging, CORS handling, and rate limiting.

## Introduction

Stacks middleware follows a Laravel-inspired pattern while leveraging TypeScript's type safety. Middleware can inspect, modify, or reject requests before they reach your route handlers.

Middleware files are stored in `app/Middleware/` and registered in `app/Middleware.ts`.

## Creating Middleware

### Basic Middleware Structure

Create a new middleware file in `app/Middleware/`:

```typescript
// app/Middleware/Logger.ts
import { log } from '@stacksjs/cli'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Logger',
  priority: 2,

  handle(request) {
    log.info(`[${request.method}] ${request.url}`)
  },
})
```

### Middleware with Async Operations

```typescript
// app/Middleware/Auth.ts
import type { Request } from '@stacksjs/router'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'
import { verifyToken } from '@stacksjs/auth'

export default new Middleware({
  name: 'Auth',
  priority: 1,

  async handle(request: Request) {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpError(401, 'Unauthenticated.')
    }

    const token = authHeader.substring(7)
    const user = await verifyToken(token)

    if (!user) {
      throw new HttpError(401, 'Invalid or expired token.')
    }

    // Attach user to request for later use
    ;(request as any)._authenticatedUser = user
  },
})
```

### Middleware Options

The `Middleware` constructor accepts these options:

```typescript
interface MiddlewareOptions {
  /** Unique name for the middleware */
  name: string

  /** Priority order (lower runs first) */
  priority?: number

  /** The handler function */
  handle: (request: Request) => void | Promise<void>
}
```

## Registering Middleware

### Middleware Aliases

Register middleware aliases in `app/Middleware.ts`:

```typescript
// app/Middleware.ts
export interface Middleware {
  [key: string]: string
}

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
  'env:staging': 'EnvStaging',
  'env:production': 'EnvProduction',
} satisfies Middleware
```

The key is the alias used in routes, and the value is the filename (without `.ts`).

## Global vs Route Middleware

### Global Middleware

Global middleware runs on every request. Register it using the router's `use` method:

```typescript
// In your app initialization
import { route } from '@stacksjs/router'
import cors from './middleware/cors'

route.use(cors)
```

### Route Middleware

Route middleware runs only on specific routes:

```typescript
import { route } from '@stacksjs/router'

// Single middleware
route.get('/dashboard', 'Actions/DashboardAction')
  .middleware('auth')

// Multiple middleware (chained)
route.post('/admin/settings', 'Actions/AdminSettingsAction')
  .middleware('auth')
  .middleware('abilities:admin')
```

## Middleware Groups

### Applying to Route Groups

Apply middleware to entire route groups:

```typescript
import { route } from '@stacksjs/router'

// All routes in this group require authentication
route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')
  route.get('/settings', 'Actions/SettingsAction')
})

// Multiple middleware on a group
route.group({ middleware: ['auth', 'throttle:60,1'] }, () => {
  route.post('/api/submit', 'Actions/SubmitAction')
  route.post('/api/upload', 'Actions/UploadAction')
})
```

### Combining Prefix and Middleware

```typescript
route.group({ prefix: '/admin', middleware: ['auth', 'can:admin'] }, () => {
  route.get('/users', 'Actions/Admin/UserIndexAction')
  route.post('/users', 'Actions/Admin/UserStoreAction')
  route.delete('/users/{id}', 'Actions/Admin/UserDestroyAction')
})
```

## Middleware Parameters

### Passing Parameters

Pass parameters to middleware using the colon syntax:

```typescript
// Throttle: 60 requests per minute
route.post('/api/data', 'Actions/DataAction')
  .middleware('throttle:60,1')

// Abilities: require 'read' and 'write' abilities
route.post('/posts', 'Actions/PostStoreAction')
  .middleware('abilities:read,write')

// Environment: only run in production
route.get('/metrics', 'Actions/MetricsAction')
  .middleware('env:production')
```

### Accessing Parameters in Middleware

```typescript
// app/Middleware/Abilities.ts
import type { Request } from '@stacksjs/router'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'abilities',
  priority: 2,

  async handle(request: Request) {
    // Parameters are available via _middlewareParams
    const requiredAbilities = (request as any)._middlewareParams?.abilities?.split(',') || []

    if (requiredAbilities.length === 0) {
      return // No abilities required
    }

    const token = (request as any)._currentAccessToken
    if (!token) {
      throw new HttpError(401, 'Unauthenticated.')
    }

    const tokenAbilities: string[] = token.abilities || []

    // Wildcard grants all permissions
    if (tokenAbilities.includes('*')) {
      return
    }

    // Check each required ability
    for (const ability of requiredAbilities) {
      if (!tokenAbilities.includes(ability.trim())) {
        throw new HttpError(403, `Missing required ability: ${ability.trim()}`)
      }
    }
  },
})
```

## Terminable Middleware

Terminable middleware can perform actions after the response has been sent:

```typescript
// app/Middleware/LogResponse.ts
import { Middleware } from '@stacksjs/router'
import { log } from '@stacksjs/logging'

export default new Middleware({
  name: 'LogResponse',
  priority: 100, // Run late

  handle(request) {
    const startTime = Date.now()
    ;(request as any)._startTime = startTime
  },

  // Called after response is sent
  terminate(request, response) {
    const startTime = (request as any)._startTime || Date.now()
    const duration = Date.now() - startTime

    log.info(`[${request.method}] ${request.url} - ${response.status} (${duration}ms)`)
  },
})
```

## Built-in Middleware

### Auth Middleware

Validates bearer tokens and authenticates users:

```typescript
route.get('/me', 'Actions/AuthUserAction').middleware('auth')
```

The auth middleware:
- Extracts the Bearer token from Authorization header
- Validates the token
- Attaches the user to `request._authenticatedUser`
- Attaches the token to `request._currentAccessToken`

### Abilities Middleware

Checks if the authenticated user's token has required abilities:

```typescript
// Require 'admin' ability
route.get('/admin', 'Actions/AdminAction')
  .middleware('auth')
  .middleware('abilities:admin')

// Require multiple abilities
route.post('/posts', 'Actions/PostAction')
  .middleware('auth')
  .middleware('abilities:posts:create,posts:update')
```

### Throttle Middleware

Rate limits requests:

```typescript
// 60 requests per minute
route.post('/api/submit', 'Actions/SubmitAction')
  .middleware('throttle:60,1')

// 10 requests per hour
route.post('/expensive-operation', 'Actions/ExpensiveAction')
  .middleware('throttle:10,60')
```

### Environment Middleware

Restricts routes to specific environments:

```typescript
// Only in local environment
route.get('/debug', 'Actions/DebugAction')
  .middleware('env:local')

// Only in production
route.get('/metrics', 'Actions/MetricsAction')
  .middleware('env:production')

// Only in development
route.get('/test', 'Actions/TestAction')
  .middleware('env:development')
```

### Maintenance Middleware

Blocks requests when application is in maintenance mode:

```typescript
route.group({ middleware: 'maintenance' }, () => {
  // These routes will return 503 during maintenance
  route.get('/api/data', 'Actions/DataAction')
})
```

## Middleware Priority

### Setting Priority

Lower priority numbers run first:

```typescript
export default new Middleware({
  name: 'Auth',
  priority: 1, // Runs before priority 2

  handle(request) {
    // Authentication logic
  },
})

export default new Middleware({
  name: 'Abilities',
  priority: 2, // Runs after priority 1

  handle(request) {
    // Ability checking (needs authenticated user)
  },
})
```

### Execution Order

1. Global middleware (in order of registration)
2. Route group middleware (in order of definition)
3. Route-specific middleware (in order of chaining)

## Creating Custom Middleware

### Logger Middleware

```typescript
// app/Middleware/Logger.ts
import { Middleware } from '@stacksjs/router'
import { log } from '@stacksjs/logging'

export default new Middleware({
  name: 'Logger',
  priority: 0, // Run first

  handle(request) {
    const timestamp = new Date().toISOString()
    log.info(`[${timestamp}] ${request.method} ${request.url}`)
  },
})
```

### CORS Middleware

```typescript
// app/Middleware/Cors.ts
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Cors',
  priority: 0,

  handle(request) {
    // CORS is typically handled at the response level
    // This middleware can set up request-level CORS checks
    const origin = request.headers.get('Origin')

    if (origin && !isAllowedOrigin(origin)) {
      throw new HttpError(403, 'Origin not allowed')
    }
  },
})

function isAllowedOrigin(origin: string): boolean {
  const allowedOrigins = ['https://example.com', 'https://app.example.com']
  return allowedOrigins.includes(origin)
}
```

### Request Sanitization Middleware

```typescript
// app/Middleware/Sanitize.ts
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Sanitize',
  priority: 5,

  handle(request) {
    // Sanitize all string inputs
    if ((request as any).jsonBody) {
      sanitizeObject((request as any).jsonBody)
    }
    if ((request as any).formBody) {
      sanitizeObject((request as any).formBody)
    }
  },
})

function sanitizeObject(obj: Record<string, any>): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key].trim()
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key])
    }
  }
}
```

## Edge Cases and Gotchas

### Middleware Order with Groups

When using nested groups, middleware stacks:

```typescript
route.group({ middleware: 'auth' }, () => {
  // 'auth' middleware applies here

  route.group({ middleware: 'logger' }, () => {
    // Both 'auth' AND 'logger' apply here
    route.get('/data', 'Actions/DataAction')
  })
})
```

### Async Middleware Errors

Always throw `HttpError` for proper error responses:

```typescript
import { HttpError } from '@stacksjs/error-handling'

export default new Middleware({
  name: 'CustomAuth',

  async handle(request) {
    try {
      await validateRequest(request)
    } catch (error) {
      // Throw HttpError for proper status codes
      throw new HttpError(401, 'Authentication failed')
    }
  },
})
```

### Middleware Short-Circuiting

When middleware throws an error, the request chain stops:

```typescript
export default new Middleware({
  name: 'BlockedRoute',

  handle() {
    // This stops all further processing
    throw new HttpError(403, 'This route is blocked')
  },
})
```

### Accessing Request Data

After body parsing, data is available via:

```typescript
handle(request) {
  // JSON body
  const jsonData = (request as any).jsonBody

  // Form data
  const formData = (request as any).formBody

  // Files
  const files = (request as any).files

  // Route parameters
  const params = request.params

  // Query parameters
  const query = (request as any).query
}
```

## API Reference

### Middleware Class

```typescript
class Middleware {
  constructor(options: {
    name: string
    priority?: number
    handle: (request: Request) => void | Promise<void>
    terminate?: (request: Request, response: Response) => void | Promise<void>
  })
}
```

### HttpError Class

```typescript
class HttpError extends Error {
  constructor(statusCode: number, message: string)

  statusCode: number
  message: string
}
```

### Request Extensions

After middleware processing, the request object includes:

| Property | Type | Description |
|----------|------|-------------|
| `_authenticatedUser` | `User` | Authenticated user (after auth middleware) |
| `_currentAccessToken` | `Token` | Current access token (after auth middleware) |
| `_middlewareParams` | `Record<string, string>` | Middleware parameters |
| `jsonBody` | `object` | Parsed JSON body |
| `formBody` | `object` | Parsed form data |
| `files` | `Record<string, File>` | Uploaded files |

## Related Documentation

- [Routing](/basics/routing) - Learn about route definitions
- [Actions](/basics/actions) - Creating action handlers
- [Error Handling](/basics/error-handling) - Handling middleware errors
- [Authentication](/features/authentication) - Authentication system
