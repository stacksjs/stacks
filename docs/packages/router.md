# Router Package

A powerful routing system built on bun-router with Stacks-specific enhancements including action/controller resolution, middleware support, and Laravel-style request helpers.

## Installation

```bash
bun add @stacksjs/router
```

## Basic Usage

```typescript
import { route, serve } from '@stacksjs/router'

// Define routes
route.get('/hello', () => Response.json({ message: 'Hello World' }))
route.post('/users', 'Actions/CreateUser')
route.get('/users/:id', 'Controllers/UserController@show')

// Start server
await serve({ port: 3000 })
```

## Route Definitions

### HTTP Methods

```typescript
import { route } from '@stacksjs/router'

// GET request
route.get('/users', () => {
  return Response.json({ users: [] })
})

// POST request
route.post('/users', async (req) => {
  const data = await req.json()
  return Response.json({ created: data })
})

// PUT request
route.put('/users/:id', 'Actions/UpdateUser')

// PATCH request
route.patch('/users/:id', 'Actions/PatchUser')

// DELETE request
route.delete('/users/:id', 'Actions/DeleteUser')

// OPTIONS request
route.options('/users', () => new Response(null, { status: 204 }))
```

### Route Parameters

```typescript
// Required parameter
route.get('/users/:id', (req) => {
  const { id } = req.params
  return Response.json({ userId: id })
})

// Multiple parameters
route.get('/posts/:postId/comments/:commentId', (req) => {
  const { postId, commentId } = req.params
  return Response.json({ postId, commentId })
})

// Optional parameters (using query strings)
route.get('/search', (req) => {
  const query = req.query.q || ''
  const page = req.query.page || '1'
  return Response.json({ query, page })
})
```

### String Handlers

Routes can reference Actions or Controllers using string paths:

```typescript
// Action-based routing
route.get('/dashboard', 'Actions/DashboardAction')
route.post('/login', 'Actions/Auth/LoginAction')

// Controller-based routing
route.get('/users', 'Controllers/UserController@index')
route.get('/users/:id', 'Controllers/UserController@show')
route.post('/users', 'Controllers/UserController@store')
route.put('/users/:id', 'Controllers/UserController@update')
route.delete('/users/:id', 'Controllers/UserController@destroy')
```

## Actions

Create actions in `app/Actions/`:

```typescript
// app/Actions/CreateUserAction.ts
export default {
  // Optional validations
  validations: {
    name: { rule: v.string().min(2), message: 'Name is required' },
    email: { rule: v.string().email(), message: 'Valid email required' }
  },

  async handle(req: EnhancedRequest) {
    const name = req.get('name')
    const email = req.get('email')

    // Create user logic...

    return Response.json({ success: true })
  }
}
```

## Controllers

Create controllers in `app/Controllers/`:

```typescript
// app/Controllers/UserController.ts
export default class UserController {
  async index(req: EnhancedRequest) {
    const users = await User.all()
    return Response.json({ users })
  }

  async show(req: EnhancedRequest) {
    const user = await User.find(req.params.id)
    return Response.json({ user })
  }

  async store(req: EnhancedRequest) {
    const data = req.only(['name', 'email', 'password'])
    const user = await User.create(data)
    return Response.json({ user }, { status: 201 })
  }

  async update(req: EnhancedRequest) {
    const user = await User.find(req.params.id)
    await user.update(req.only(['name', 'email']))
    return Response.json({ user })
  }

  async destroy(req: EnhancedRequest) {
    await User.where('id', '=', req.params.id).delete()
    return new Response(null, { status: 204 })
  }
}
```

## Route Groups

```typescript
// Prefix all routes
route.group({ prefix: '/api/v1' }, () => {
  route.get('/users', 'Controllers/UserController@index')
  route.get('/posts', 'Controllers/PostController@index')
})

// With middleware
route.group({ prefix: '/admin', middleware: 'auth' }, () => {
  route.get('/dashboard', 'Actions/AdminDashboard')
  route.get('/users', 'Actions/AdminUsers')
})

// Multiple middleware
route.group({ middleware: ['auth', 'admin'] }, () => {
  route.get('/settings', 'Actions/AdminSettings')
})

// Nested groups
route.group({ prefix: '/api' }, () => {
  route.group({ prefix: '/v1', middleware: 'auth' }, () => {
    route.get('/me', 'Actions/GetCurrentUser')
  })
})
```

## Middleware

### Using Middleware

```typescript
// Single route middleware
route.get('/profile', 'Actions/Profile').middleware('auth')

// Multiple middleware
route.get('/admin', 'Actions/Admin')
  .middleware('auth')
  .middleware('admin')

// Middleware with parameters
route.get('/posts', 'Actions/Posts')
  .middleware('abilities:read,write')
```

### Built-in Auth Middleware

```typescript
// Protect routes with authentication
route.get('/dashboard', 'Actions/Dashboard').middleware('auth')

// The auth middleware:
// - Validates bearer token
// - Loads authenticated user
// - Makes user available via req.user()
```

### Creating Custom Middleware

```typescript
// app/Middleware/AdminMiddleware.ts
export default {
  async handle(req: EnhancedRequest) {
    const user = await req.user()

    if (!user || user.role !== 'admin') {
      throw { statusCode: 403, message: 'Forbidden' }
    }

    // Continue to next middleware/handler
  }
}
```

## Request Helpers

The enhanced request object provides Laravel-style helpers:

### Input Methods

```typescript
route.post('/users', async (req) => {
  // Get single input value
  const name = req.get('name')
  const email = req.input('email')

  // Get all input
  const allInput = req.all()

  // Get only specific fields
  const userData = req.only(['name', 'email', 'password'])

  // Get all except specific fields
  const safeData = req.except(['password', 'token'])

  // Check if input exists
  if (req.has('remember')) { /* ... */ }
  if (req.hasAny(['email', 'phone'])) { /* ... */ }

  // Check if input is filled (not empty)
  if (req.filled('name')) { /* ... */ }

  // Check if input is missing
  if (req.missing('optional_field')) { /* ... */ }
})
```

### Type Casting

```typescript
route.get('/products', (req) => {
  // Cast to string (with default)
  const search = req.string('q', '')

  // Cast to integer
  const page = req.integer('page', 1)

  // Cast to float
  const minPrice = req.float('min_price', 0.0)

  // Cast to boolean
  const inStock = req.boolean('in_stock', false)

  // Cast to array
  const categories = req.array('categories')
})
```

### File Uploads

```typescript
route.post('/upload', async (req) => {
  // Get single file
  const avatar = req.file('avatar')
  if (avatar) {
    // Store file
    await avatar.store('avatars')
    // Or with custom filename
    await avatar.storeAs('avatars', 'custom-name.jpg')
  }

  // Get multiple files
  const documents = req.getFiles('documents')
  for (const doc of documents) {
    await doc.store('documents')
  }

  // Check if file exists
  if (req.hasFile('resume')) { /* ... */ }

  // Get all files
  const allFiles = req.allFiles()
})
```

### Authentication Helpers

```typescript
route.get('/profile', async (req) => {
  // Get authenticated user
  const user = await req.user()

  // Get user's access token
  const token = await req.userToken()

  // Check token abilities
  if (await req.tokenCan('posts:write')) {
    // User can write posts
  }

  if (await req.tokenCant('admin:access')) {
    // User cannot access admin
  }
})
```

## Response Helpers

```typescript
import { json, redirect, view } from '@stacksjs/router'

// JSON response
route.get('/api/data', () => {
  return Response.json({ data: 'value' })
})

// With status code
route.post('/users', () => {
  return Response.json({ created: true }, { status: 201 })
})

// Plain text
route.get('/health', () => {
  return new Response('OK', { status: 200 })
})

// Redirect
route.get('/old-path', () => {
  return Response.redirect('/new-path', 301)
})

// No content
route.delete('/items/:id', () => {
  return new Response(null, { status: 204 })
})
```

## Health Check Route

```typescript
// Add health check endpoint
route.health()
// Creates GET /health returning { status: 'healthy', timestamp: ... }
```

## Route Loading

### From Route Registry

```typescript
// app/Routes.ts
export default {
  '/': 'Actions/HomeAction',
  '/about': 'Actions/AboutAction',
  'GET /users': 'Controllers/UserController@index',
  'POST /users': 'Controllers/UserController@store',
}

// Load routes
await route.importRoutes()
```

### Manual Loading

```typescript
import { loadRoutes } from '@stacksjs/router'

const routes = {
  '/api/v1/users': 'Controllers/Api/UserController@index',
  '/api/v1/posts': 'Controllers/Api/PostController@index',
}

await loadRoutes(routes)
```

## Server Configuration

```typescript
import { serve } from '@stacksjs/router'

await serve({
  port: 3000,
  hostname: '0.0.0.0',

  // Development mode
  development: process.env.NODE_ENV !== 'production',

  // TLS/SSL
  tls: {
    cert: './cert.pem',
    key: './key.pem',
  },

  // Request hooks
  fetch(req, server) {
    // Custom request handling
  },
})
```

## Global Middleware

```typescript
import { route } from '@stacksjs/router'

// Add global middleware
route.use(async (req) => {
  // Runs for all requests
  console.log(`${req.method} ${req.url}`)
})

// CORS middleware example
route.use((req) => {
  // Add CORS headers if needed
})
```

## Request Context

Access the current request anywhere in your application:

```typescript
import { request, getCurrentRequest } from '@stacksjs/router'

// In an action or service
export async function someFunction() {
  const currentUser = await request.user()
  const token = request.bearerToken()
}
```

## Edge Cases

### Handling 404 Not Found

```typescript
// bun-router handles 404 automatically
// Custom 404 handling can be done via global middleware
route.use((req) => {
  // After all routes, if no response, return 404
})
```

### Error Handling

```typescript
route.get('/error-prone', async (req) => {
  try {
    // Risky operation
  } catch (error) {
    return Response.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
})
```

### Async Route Handlers

```typescript
// All route handlers support async/await
route.get('/async', async (req) => {
  const data = await fetchSomeData()
  const processed = await processData(data)
  return Response.json(processed)
})
```

### Request Body Parsing

```typescript
// JSON body is automatically parsed
route.post('/json', async (req) => {
  const body = req.jsonBody // Already parsed
  return Response.json(body)
})

// Form data is automatically parsed
route.post('/form', async (req) => {
  const formData = req.formBody
  return Response.json(formData)
})
```

## API Reference

### Route Methods

| Method | Description |
|--------|-------------|
| `get(path, handler)` | Register GET route |
| `post(path, handler)` | Register POST route |
| `put(path, handler)` | Register PUT route |
| `patch(path, handler)` | Register PATCH route |
| `delete(path, handler)` | Register DELETE route |
| `options(path, handler)` | Register OPTIONS route |
| `group(options, callback)` | Create route group |
| `health()` | Add health check route |
| `use(middleware)` | Add global middleware |
| `serve(options)` | Start the server |

### Request Methods

| Method | Description |
|--------|-------------|
| `get(key, default?)` | Get input value |
| `input(key, default?)` | Alias for get |
| `all()` | Get all input |
| `only(keys)` | Get only specified keys |
| `except(keys)` | Get all except keys |
| `has(key)` | Check if key exists |
| `filled(key)` | Check if key is filled |
| `missing(key)` | Check if key is missing |
| `string(key, default?)` | Get as string |
| `integer(key, default?)` | Get as integer |
| `float(key, default?)` | Get as float |
| `boolean(key, default?)` | Get as boolean |
| `array(key)` | Get as array |
| `file(key)` | Get uploaded file |
| `getFiles(key)` | Get multiple files |
| `hasFile(key)` | Check if file exists |
| `user()` | Get authenticated user |
| `tokenCan(ability)` | Check token ability |

### Chainable Route Methods

| Method | Description |
|--------|-------------|
| `middleware(name)` | Add route middleware |
