---
title: Build an API
description: "This tutorial will guide you through building a RESTful API with Stacks. You will learn how to create routes, actions, controllers, handle validation, impl..."
---
# Build an API

This tutorial will guide you through building a RESTful API with Stacks. You will learn how to create routes, actions, controllers, handle validation, implement authentication, and interact with the database.

## API Architecture Overview

Stacks follows a clean, Laravel-inspired architecture for APIs:

- **Routes** - define API endpoints and name the action that handles each
- **Actions** - one unit of business logic per file, and what routes point at
- **Middleware** - cross-cutting concerns (auth, throttling, logging)
- **Models** - schema, validation, relationships, and database access

## Creating Routes

Routes are defined in the `routes/` directory. The main API routes go in `routes/api.ts`.

### Basic Routes

```typescript
// routes/api.ts
import { response, route } from '@stacksjs/router'

// Simple GET route with inline handler
route.get('/', () => response.text('Hello, World!'))

// Return JSON
route.get('/status', () => response.json({
  status: 'ok',
  timestamp: Date.now(),
}))

// Route with path parameters
route.get('/users/{id}', (request) => {
  const userId = request.param('id')
  return response.json({ userId })
})

// Different HTTP methods
route.post('/users', 'Actions/User/CreateUserAction')
route.put('/users/{id}', 'Actions/User/UpdateUserAction')
route.patch('/users/{id}', 'Actions/User/PatchUserAction')
route.delete('/users/{id}', 'Actions/User/DeleteUserAction')
```

### Route Groups

Group routes with shared configuration:

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

// Group with prefix
route.group({ prefix: '/api/v1' }, () => {
  route.get('/users', 'Actions/User/ListUsersAction')
  route.get('/users/{id}', 'Actions/User/GetUserAction')
  route.post('/users', 'Actions/User/CreateUserAction')
})

// Group with middleware
route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')
})

// Combine prefix and middleware
route.group({ prefix: '/admin', middleware: ['auth', 'admin'] }, () => {
  route.get('/dashboard', 'Actions/Admin/DashboardAction')
  route.get('/users', 'Actions/Admin/ListUsersAction')
})
```

### Special Routes

Stacks provides convenience methods for common routes:

```typescript
// Health check endpoint (GET /health)
route.health()

// Route to an action
route.action('/example') // equivalent to route.get('/example', 'ExampleAction')

// Route to a job
route.job('/process') // equivalent to route.get('/process', 'ProcessJob')
```

## Creating Actions

Actions are reusable units of business logic. They can be called from routes, CLI commands, event listeners, or other actions.

### Generate an Action

```bash
buddy make:action CreateUser
```

### Action Structure

```typescript
// app/Actions/User/CreateUserAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'CreateUserAction',
  description: 'Create a new user',
  method: 'POST',

  // Define validation rules
  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Email must be a valid email address.',
    },
    password: {
      rule: schema.string().min(8).max(255),
      message: 'Password must be between 8 and 255 characters.',
    },
    name: {
      rule: schema.string().min(2).max(100),
      message: 'Name must be between 2 and 100 characters.',
    },
  },

  // Handle the request
  async handle(request: RequestInstance) {
    const email = request.get('email')
    const password = request.get('password')
    const name = request.get('name')

    // Create the user (database operation)
    const user = await User.create({
      email,
      password: await hash(password),
      name,
    })

    return response.json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    }, 201)
  },
})
```

### Action with Manual Validation

You can also validate manually within the handle method:

```typescript
// app/Actions/Auth/RegisterAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Auth, register } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'RegisterAction',
  description: 'Register a new user',
  method: 'POST',

  async handle(request: RequestInstance) {
    // Validate manually with custom messages
    await request.validate({
      email: {
        rule: schema.string().email(),
        message: {
          email: 'Email must be a valid email address',
        },
      },
      password: {
        rule: schema.string().min(6).max(255),
        message: {
          min: 'Password must have a minimum of 6 characters',
          max: 'Password must have a maximum of 255 characters',
        },
      },
      name: {
        rule: schema.string().min(2).max(255),
        message: {
          min: 'Name must have a minimum of 2 characters',
          max: 'Name must have a maximum of 255 characters',
        },
      },
    })

    const email = request.get('email')
    const password = request.get('password')
    const name = request.get('name')

    const result = await register({ email, password, name })

    if (result) {
      const user = await Auth.getUserFromToken(result.token)

      return response.json({
        token: result.token,
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
        },
      })
    }

    return response.error('Registration failed')
  },
})
```

## Organising endpoints

### Action Structure

Stacks has no controller layer. Each endpoint is one action, and the route names
it directly. That keeps a file small enough to read in one sitting and makes it
callable from a test without going through HTTP.

```typescript
// app/Actions/User/UserIndexAction.ts
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'UserIndexAction',
  description: 'Lists users, paginated',

  async handle(request) {
    return response.json(await User.paginate({
      page: Number(request.query('page') ?? 1),
      perPage: Number(request.query('perPage') ?? 10),
    }))
  },
})
```

```typescript
// app/Actions/User/UserShowAction.ts
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'UserShowAction',
  description: 'Returns a single user',

  async handle(request) {
    const user = await User.find(request.getParam('id'))

    if (!user)
      return response.notFound('User not found')

    return response.json(user)
  },
})
```

```typescript
// app/Actions/User/UserStoreAction.ts
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'UserStoreAction',
  description: 'Creates a user',

  // Runs before handle — a failing request never reaches your logic
  validations: {
    email: { rule: schema.string().email() },
    name: { rule: schema.string().max(255) },
    password: { rule: schema.string().min(8) },
  },

  async handle(request) {
    const user = await User.create(request.only(['email', 'name', 'password']))

    return response.json(user, 201)
  },
})
```

`User` needs no import: models are auto-imported as server globals.

Wire them up in a route file:

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

route.get('/users', 'Actions/User/UserIndexAction')
route.get('/users/{id}', 'Actions/User/UserShowAction')
route.post('/users', 'Actions/User/UserStoreAction')
route.put('/users/{id}', 'Actions/User/UserUpdateAction')
route.delete('/users/{id}', 'Actions/User/UserDestroyAction')
```

For plain CRUD you do not have to write any of this. Put `useApi` on the model
and Stacks generates the five actions and their routes for you:

```typescript
traits: {
  useApi: { uri: 'users', routes: ['index', 'show', 'store', 'update', 'destroy'] },
},
```

Write actions by hand when an endpoint does something the generated CRUD does
not.

## Validation

Stacks provides a powerful validation system using schemas.

### Available Validation Rules

```typescript
import { schema } from '@stacksjs/validation'

// String validations
schema.string()                    // Must be a string
schema.string().email()            // Must be valid email
schema.string().url()              // Must be valid URL
schema.string().min(5)             // Minimum length
schema.string().max(100)           // Maximum length
schema.string().regex(/pattern/)   // Must match pattern

// Number validations
schema.number()                    // Must be a number
schema.number().min(0)             // Minimum value
schema.number().max(100)           // Maximum value
schema.number().positive()         // Must be positive
schema.number().integer()          // Must be integer

// Boolean
schema.boolean()                   // Must be boolean

// Array
schema.array()                     // Must be array
schema.array().min(1)              // Minimum items
schema.array().max(10)             // Maximum items

// Object
schema.object()                    // Must be object

// Optional fields
schema.string().optional()         // Field is optional

// Nullable fields
schema.string().nullable()         // Can be null
```

### Validation in Actions

```typescript
export default new Action({
  name: 'CreatePostAction',
  method: 'POST',

  validations: {
    title: {
      rule: schema.string().min(5).max(200),
      message: 'Title must be between 5 and 200 characters.',
    },
    content: {
      rule: schema.string().min(10),
      message: 'Content must be at least 10 characters.',
    },
    tags: {
      rule: schema.array().min(1).max(5).optional(),
      message: 'You can add between 1 and 5 tags.',
    },
    published: {
      rule: schema.boolean().optional(),
      message: 'Published must be a boolean.',
    },
  },

  async handle(request: RequestInstance) {
    // Validation happens automatically before handle() is called
    // If validation fails, a 422 response is returned

    const title = request.get('title')
    const content = request.get('content')
    const tags = request.get('tags', [])
    const published = request.get('published', false)

    // ... create post
  },
})
```

## Authentication

Stacks includes built-in authentication with token-based auth.

### Configuration

```typescript
// config/auth.ts
export default {
  default: 'api',

  guards: {
    api: {
      driver: 'token',
      provider: 'users',
    },
  },

  providers: {
    users: {
      driver: 'database',
      table: 'users',
    },
  },

  username: 'email',
  password: 'password',
  tokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days
  tokenRotation: 24, // hours

  passwordReset: {
    expire: 60, // minutes
    throttle: 60, // seconds
  },
}
```

### Login Action

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

### Protected Routes

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

// Public routes
route.post('/login', 'Actions/Auth/LoginAction')
route.post('/register', 'Actions/Auth/RegisterAction')

// Protected routes
route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')
  route.get('/tokens', 'Actions/Auth/ListTokensAction')
  route.delete('/tokens/{id}', 'Actions/Auth/RevokeTokenAction')
})
```

### Using Auth in Actions

```typescript
// app/Actions/Auth/AuthUserAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'AuthUserAction',
  description: 'Get authenticated user',
  method: 'GET',

  async handle(request: RequestInstance) {
    // The auth middleware ensures user is authenticated
    const user = request.user()

    return response.json({
      id: user.id,
      email: user.email,
      name: user.name,
    })
  },
})
```

## Database Queries

Stacks provides an ORM and query builder for database operations.

### Models

```typescript
// app/Models/User.ts
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'User',
  table: 'users',

  traits: {
    useTimestamps: true,   // created_at / updated_at
  },

  hasMany: ['Post'],
  hasOne: ['Profile'],

  attributes: {
    name: {
      required: true,
      fillable: true,
      validation: { rule: schema.string().max(255) },
    },
    email: {
      required: true,
      unique: true,
      fillable: true,
      validation: { rule: schema.string().email() },
    },
    password: {
      required: true,
      hidden: true,          // excluded from JSON
      validation: { rule: schema.string().min(8) },
    },
  },
} as const)
```

### Basic Queries

```typescript
// Find by ID
const user = await User.find(1)

// Find or fail (throws if not found)
const user = await User.findOrFail(1)

// Find by column
const user = await User.where('email', 'user@example.com').first()

// Get all
const users = await User.all()

// With conditions
const activeUsers = await User.where('status', 'active')
  .orderBy('created*at', 'desc')
  .get()

// Create
const user = await User.create({
  email: 'new@example.com',
  name: 'New User',
  password: hashedPassword,
})

// Update
await user.update({ name: 'Updated Name' })

// Delete
await user.delete()
```

### Query Builder

```typescript
import { DB } from '@stacksjs/database'

// Raw queries
const users = await DB.table('users')
  .select('id', 'name', 'email')
  .where('status', 'active')
  .orderBy('name')
  .limit(10)
  .get()

// Joins
const posts = await DB.table('posts')
  .join('users', 'posts.user*id', '=', 'users.id')
  .select('posts.*', 'users.name as author')
  .get()

// Aggregates
const count = await DB.table('users').count()
const total = await DB.table('orders').sum('amount')
const avg = await DB.table('products').avg('price')
```

### Pagination

```typescript
// In a controller or action
async index(request: RequestInstance) {
  const page = request.query('page', 1)
  const perPage = request.query('per*page', 15)

  const users = await User.paginate(page, perPage)

  return response.json({
    data: users.data,
    meta: {
      current*page: users.currentPage,
      per*page: users.perPage,
      total: users.total,
      last*page: users.lastPage,
    },
  })
}
```

## Response Helpers

Stacks provides various response helpers:

```typescript
import { response } from '@stacksjs/router'

// JSON response
response.json({ data: 'value' })
response.json({ data: 'value' }, 201) // with status code

// Text response
response.text('Hello, World!')

// Error responses
response.error('Something went wrong')
response.error('Something went wrong', 500)

// Common HTTP status responses
response.notFound('Resource not found')
response.unauthorized('Please login')
response.forbidden('Access denied')
response.badRequest('Invalid request')

// Redirect
response.redirect('/new-location')

// No content
response.noContent()
```

## Complete Example: Blog API

Let us build a complete blog API:

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

// Public routes
route.get('/posts', 'Actions/Blog/ListPostsAction')
route.get('/posts/{slug}', 'Actions/Blog/GetPostAction')

// Protected routes
route.group({ middleware: 'auth' }, () => {
  route.post('/posts', 'Actions/Blog/CreatePostAction')
  route.put('/posts/{id}', 'Actions/Blog/UpdatePostAction')
  route.delete('/posts/{id}', 'Actions/Blog/DeletePostAction')
})
```

```typescript
// app/Actions/Blog/CreatePostAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'
import { slugify } from '@stacksjs/strings'

export default new Action({
  name: 'CreatePostAction',
  description: 'Create a new blog post',
  method: 'POST',

  validations: {
    title: {
      rule: schema.string().min(5).max(200),
      message: 'Title must be between 5 and 200 characters.',
    },
    content: {
      rule: schema.string().min(50),
      message: 'Content must be at least 50 characters.',
    },
    excerpt: {
      rule: schema.string().max(500).optional(),
      message: 'Excerpt must be at most 500 characters.',
    },
    tags: {
      rule: schema.array().max(10).optional(),
      message: 'Maximum 10 tags allowed.',
    },
  },

  async handle(request: RequestInstance) {
    const user = request.user()
    const title = request.get('title')
    const content = request.get('content')
    const excerpt = request.get('excerpt', '')
    const tags = request.get('tags', [])

    const post = await Post.create({
      title,
      slug: slugify(title),
      content,
      excerpt: excerpt || content.substring(0, 200),
      author*id: user.id,
      published*at: null,
    })

    // Attach tags
    if (tags.length > 0) {
      await post.tags().attach(tags)
    }

    return response.json({
      message: 'Post created successfully',
      post: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        author: user.name,
      },
    }, 201)
  },
})
```

```typescript
// app/Actions/Blog/ListPostsAction.ts
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ListPostsAction',
  description: 'List all published blog posts',
  method: 'GET',

  async handle(request: RequestInstance) {
    const page = request.query('page', 1)
    const perPage = request.query('per*page', 10)
    const tag = request.query('tag')

    let query = Post.where('published*at', '!=', null)
      .with('author', 'tags')
      .orderBy('published*at', 'desc')

    if (tag) {
      query = query.whereHas('tags', (q) => q.where('slug', tag))
    }

    const posts = await query.paginate(page, perPage)

    return response.json({
      data: posts.data.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        author: post.author.name,
        tags: post.tags.map(t => t.name),
        published*at: post.published*at,
      })),
      meta: {
        current*page: posts.currentPage,
        per*page: posts.perPage,
        total: posts.total,
        last*page: posts.lastPage,
      },
    })
  },
})
```

## Next Steps

Now that you know how to build APIs with Stacks, continue to:

- [Authentication How-To](/bootcamp/how-to/authentication) - Deep dive into authentication
- [Testing How-To](/bootcamp/how-to/testing) - Test your API endpoints
- [Deployment How-To](/bootcamp/how-to/deploy) - Deploy your API to production

## Related Documentation

- [Routing Guide](/basics/routing)
- [Actions Guide](/basics/actions)
- [Validation Guide](/packages/validation)
- [Database Guide](/packages/database)
- [Authentication Guide](/guide/auth)
