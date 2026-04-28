---
title: Routing
---
// Points to app/Controllers/ComingSoonController.ts, index method
route.get('/coming-soon', 'Controllers/ComingSoonController@index')

// Points to app/Controllers/QueryController.ts with various methods
route.get('/queries/stats', 'Controllers/QueryController@getStats')
route.get('/queries/recent', 'Controllers/QueryController@getRecentQueries')
route.get('/queries/slow', 'Controllers/QueryController@getSlowQueries')
route.get('/queries/:id', 'Controllers/QueryController@getQuery')
route.post('/queries/prune', 'Controllers/QueryController@pruneQueryLogs')

```

### Action File Structure

When you reference `'Actions/Auth/LoginAction'`, Stacks looks for this file:

```typescript

// app/Actions/Auth/LoginAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Auth } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'LoginAction',
  description: 'Login to the application',
  method: 'POST',

  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Email must be a valid email address.',
    },
    password: {
      rule: schema.string().min(6).max(255),
      message: 'Password must be between 6 and 255 characters.',
    },
  },

  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')

    const result = await Auth.login({ email, password })

    if (result) {
      return response.json({
        token: result.token,
        user: {
          id: result.user?.id,
          email: result.user?.email,
          name: result.user?.name,
        },
      })
    }

    return response.unauthorized('Incorrect email or password')
  },
})

```

## Route Groups

Group related routes with shared configuration:

### Prefix Groups

```typescript

// All routes in this group will be prefixed with /auth
route.group({ prefix: '/auth' }, () => {
  route.post('/refresh', 'Actions/Auth/RefreshTokenAction')
  route.get('/tokens', 'Actions/Auth/ListTokensAction')
  route.post('/token', 'Actions/Auth/CreateTokenAction')
  route.delete('/tokens/{id}', 'Actions/Auth/RevokeTokenAction')
})

// Nested prefix groups
route.group({ prefix: '/api/v1' }, () => {
  route.group({ prefix: '/users' }, () => {
    route.get('/', 'Actions/User/IndexAction')
    route.get('/{id}', 'Actions/User/ShowAction')
    route.post('/', 'Actions/User/StoreAction')
  })
})

```

### Middleware Groups

```typescript

// Apply middleware to all routes in the group
route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')
})

// Multiple middleware
route.group({ middleware: ['auth', 'throttle:60,1'] }, () => {
  route.get('/dashboard', 'Actions/DashboardAction')
  route.get('/settings', 'Actions/SettingsAction')
})

```

### Combined Group Options

```typescript

route.group({ prefix: '/payments', middleware: 'auth' }, () => {
  route.get('/fetch-customer/{id}', 'Actions/Payment/FetchPaymentCustomerAction')
  route.get('/transaction-history/{id}', 'Actions/Payment/FetchTransactionHistoryAction')
  route.post('/create-subscription/{id}', 'Actions/Payment/CreateSubscriptionAction')
  route.post('/cancel-subscription/{id}', 'Actions/Payment/CancelSubscriptionAction')
})

```

## Middleware Attachment

### Single Route Middleware

```typescript

// Chain middleware to individual routes
route.get('/admin', 'Actions/AdminAction').middleware('auth')

// Multiple middleware on a single route
route.get('/admin/settings', 'Actions/AdminSettingsAction')
  .middleware('auth')
  .middleware('abilities:admin')

// Middleware with parameters
route.post('/api/data', 'Actions/DataAction')
  .middleware('throttle:100,1')
  .middleware('auth')

```

### Available Middleware

Stacks comes with several built-in middleware defined in `app/Middleware.ts`:

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
  'env:staging': 'EnvStaging',
  'env:production': 'EnvProduction',
} satisfies Middleware

```

For more details, see the [Middleware documentation](/basics/middleware).

## Route File Registry

Stacks uses `app/Routes.ts` to register which route files to load and how to prefix them:

```typescript

// app/Routes.ts
export default {
  // Default API routes (no prefix) - loads routes/api.ts at /*
  'api': 'api',

  // Versioned routes with explicit prefix - loads routes/v1.ts at /v1/*
  'v1': { path: 'v1', prefix: 'v1' },

  // Admin routes with middleware - loads routes/admin.ts at /admin/*
  'admin': { path: 'admin', middleware: ['auth'] },

  // No prefix override - loads routes/internal.ts at /* (no prefix)
  'internal': { path: 'internal', prefix: '' },
} satisfies RouteRegistry

```

### Route Definition Types

```typescript

export interface RouteDefinition {
  /** Route file path (relative to routes/) */
  path: string
  /** Optional URL prefix (overrides the key-based prefix) */
  prefix?: string
  /** Optional middleware for all routes in file */
  middleware?: string | string[]
}

// Simple string format (key becomes prefix)
'v1': 'api/v1',  // Loads routes/api/v1.ts at /v1/*

// Object format with explicit config
'legacy': { path: 'api/v1', prefix: '/api/v1' },

```

## Special Routes

### Health Check Route

Stacks provides a built-in health check route:

```typescript

// Adds GET /health endpoint
route.health()

```

This returns a JSON response with service status information.

### Email Route

```typescript

// Adds email preview route (development only)
route.email('/welcome')

```

## Edge Cases and Advanced Patterns

### Optional Parameters

Currently, Stacks handles optional parameters through separate route definitions:

```typescript

// Two routes for optional parameter
route.get('/posts', 'Actions/Post/IndexAction')
route.get('/posts/{category}', 'Actions/Post/IndexAction')

```

### Catch-All Routes

```typescript

// Match any path under /docs
route.get('/docs/{path}', 'Actions/DocsAction').where('path', '.*')

```

### Route Priority

Routes are matched in the order they are defined. More specific routes should come before catch-all routes:

```typescript

// Specific route first
route.get('/users/me', 'Actions/User/CurrentUserAction')

// Parameterized route after
route.get('/users/{id}', 'Actions/User/ShowAction')

// Catch-all route last
route.get('/users/{path}', 'Actions/User/FallbackAction').where('path', '.*')

```

### Route Naming (Coming Soon)

```typescript

// Future support for named routes
route.get('/users/{id}', 'Actions/User/ShowAction').name('users.show')

// Generate URL from route name
const url = route.url('users.show', { id: 123 })

```

## Related Documentation

- [Middleware](/basics/middleware) - Learn about request middleware
- [Actions](/basics/actions) - Creating action handlers
- [Controllers](/basics/controllers) - Using controllers
- [Validation](/packages/validation) - Request validation
