# Functions

Functions in Stacks are server-side TypeScript files that handle business logic, API endpoints, and actions. They provide a simple, file-based approach to building your application's backend.

## Overview

Stacks functions help you:

- **Handle API requests** - Build REST endpoints
- **Execute business logic** - Process data and perform operations
- **Access databases** - Query and mutate data
- **Integrate services** - Connect to external APIs

## Quick Start

### Creating a Function

Functions live in `app/Functions/`:

```typescript
// app/Functions/GetUsers.ts
import { db } from '@stacksjs/database'
import type { FunctionContext } from '@stacksjs/types'

export default async function GetUsers(ctx: FunctionContext) {
  const users = await db
    .selectFrom('users')
    .select(['id', 'name', 'email'])
    .execute()

  return users
}
```

### Using Functions

Functions are automatically available as API endpoints:

```typescript
// GET /api/functions/GetUsers
const response = await fetch('/api/functions/GetUsers')
const users = await response.json()
```

Or call directly from other server code:

```typescript
import GetUsers from '@/Functions/GetUsers'

const users = await GetUsers(context)
```

## Function Context

Every function receives a context object:

```typescript
import type { FunctionContext } from '@stacksjs/types'

export default async function MyFunction(ctx: FunctionContext) {
  // Request data
  ctx.request       // The incoming Request object
  ctx.body          // Parsed request body
  ctx.params        // URL parameters
  ctx.query         // Query string parameters
  ctx.headers       // Request headers

  // Authentication
  ctx.user          // Authenticated user (if any)
  ctx.isAuthenticated // Boolean auth status

  // Utilities
  ctx.log           // Logger instance
  ctx.cache         // Cache instance
}
```

## Request Handling

### Query Parameters

```typescript
// GET /api/functions/SearchUsers?q=john&page=1&limit=10
export default async function SearchUsers(ctx: FunctionContext) {
  const { q, page = '1', limit = '10' } = ctx.query

  const users = await db
    .selectFrom('users')
    .where('name', 'like', `%${q}%`)
    .limit(Number.parseInt(limit))
    .offset((Number.parseInt(page) - 1) * Number.parseInt(limit))
    .execute()

  return {
    data: users,
    page: Number.parseInt(page),
    limit: Number.parseInt(limit),
  }
}
```

### Request Body

```typescript
// POST /api/functions/CreateUser
interface CreateUserBody {
  name: string
  email: string
  password: string
}

export default async function CreateUser(ctx: FunctionContext) {
  const body = ctx.body as CreateUserBody

  // Validate
  if (!body.email || !body.password) {
    return ctx.error('Email and password are required', 400)
  }

  // Create user
  const user = await db
    .insertInto('users')
    .values({
      name: body.name,
      email: body.email,
      password: await hash(body.password),
    })
    .returning(['id', 'name', 'email'])
    .executeTakeFirst()

  return ctx.json(user, 201)
}
```

### URL Parameters

```typescript
// GET /api/functions/GetUser/123
export default async function GetUser(ctx: FunctionContext) {
  const { id } = ctx.params

  const user = await db
    .selectFrom('users')
    .where('id', '=', Number(id))
    .selectAll()
    .executeTakeFirst()

  if (!user) {
    return ctx.error('User not found', 404)
  }

  return user
}
```

## Response Helpers

### JSON Responses

```typescript
export default async function MyFunction(ctx: FunctionContext) {
  // Simple return (auto-serialized to JSON)
  return { message: 'Hello' }

  // With status code
  return ctx.json({ message: 'Created' }, 201)

  // With headers
  return ctx.json(data, 200, {
    'X-Custom-Header': 'value',
  })
}
```

### Error Responses

```typescript
export default async function MyFunction(ctx: FunctionContext) {
  // Simple error
  return ctx.error('Something went wrong', 500)

  // Validation errors
  return ctx.error({
    message: 'Validation failed',
    errors: {
      email: ['Invalid email format'],
      password: ['Must be at least 8 characters'],
    },
  }, 422)

  // Or throw exceptions
  if (!authorized) {
    throw new HttpException(403, 'Forbidden')
  }
}
```

### Redirect

```typescript
export default async function MyFunction(ctx: FunctionContext) {
  // Temporary redirect (302)
  return ctx.redirect('/new-location')

  // Permanent redirect (301)
  return ctx.redirect('/new-location', 301)
}
```

## Authentication

### Protected Functions

```typescript
// app/Functions/GetProfile.ts
export default async function GetProfile(ctx: FunctionContext) {
  // Check authentication
  if (!ctx.isAuthenticated) {
    return ctx.error('Unauthorized', 401)
  }

  // Access the authenticated user
  const user = ctx.user

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  }
}

// Export config to require auth
export const config = {
  auth: true,  // Requires authentication
}
```

### Authorization

```typescript
export default async function AdminOnly(ctx: FunctionContext) {
  if (!ctx.isAuthenticated) {
    return ctx.error('Unauthorized', 401)
  }

  if (ctx.user.role !== 'admin') {
    return ctx.error('Forbidden', 403)
  }

  // Admin-only logic here
  return { secret: 'data' }
}
```

## Validation

### Manual Validation

```typescript
import { validate } from '@stacksjs/validation'

export default async function CreatePost(ctx: FunctionContext) {
  const errors = validate(ctx.body, {
    title: 'required|string|min:3|max:200',
    content: 'required|string|min:10',
    category: 'required|in:tech,news,lifestyle',
  })

  if (errors) {
    return ctx.error({ message: 'Validation failed', errors }, 422)
  }

  // Proceed with valid data
  const post = await db.insertInto('posts').values(ctx.body).execute()

  return ctx.json(post, 201)
}
```

### Using Validators

```typescript
import { CreatePostValidator } from '@/Validators/CreatePostValidator'

export default async function CreatePost(ctx: FunctionContext) {
  const validated = await CreatePostValidator.validate(ctx.body)

  if (validated.failed) {
    return ctx.error(validated.errors, 422)
  }

  const post = await db.insertInto('posts').values(validated.data).execute()

  return ctx.json(post, 201)
}
```

## Database Operations

### Queries

```typescript
import { db } from '@stacksjs/database'

export default async function GetPosts(ctx: FunctionContext) {
  const { page = '1', category } = ctx.query

  let query = db
    .selectFrom('posts')
    .innerJoin('users', 'users.id', 'posts.author_id')
    .select([
      'posts.id',
      'posts.title',
      'posts.created_at',
      'users.name as author',
    ])
    .orderBy('posts.created_at', 'desc')

  if (category) {
    query = query.where('posts.category', '=', category)
  }

  const posts = await query
    .limit(10)
    .offset((Number.parseInt(page) - 1) * 10)
    .execute()

  return { data: posts, page: Number.parseInt(page) }
}
```

### Mutations

```typescript
export default async function UpdateUser(ctx: FunctionContext) {
  const { id } = ctx.params
  const { name, email } = ctx.body

  const user = await db
    .updateTable('users')
    .set({ name, email, updated_at: new Date() })
    .where('id', '=', Number(id))
    .returning(['id', 'name', 'email'])
    .executeTakeFirst()

  if (!user) {
    return ctx.error('User not found', 404)
  }

  return user
}
```

### Transactions

```typescript
export default async function TransferFunds(ctx: FunctionContext) {
  const { fromAccount, toAccount, amount } = ctx.body

  await db.transaction().execute(async (trx) => {
    // Debit from source
    await trx
      .updateTable('accounts')
      .set((eb) => ({
        balance: eb('balance', '-', amount),
      }))
      .where('id', '=', fromAccount)
      .execute()

    // Credit to destination
    await trx
      .updateTable('accounts')
      .set((eb) => ({
        balance: eb('balance', '+', amount),
      }))
      .where('id', '=', toAccount)
      .execute()

    // Record transaction
    await trx
      .insertInto('transactions')
      .values({
        from_account: fromAccount,
        to_account: toAccount,
        amount,
        created_at: new Date(),
      })
      .execute()
  })

  return { success: true }
}
```

## Caching

```typescript
export default async function GetDashboard(ctx: FunctionContext) {
  // Try cache first
  const cached = await ctx.cache.get('dashboard:stats')
  if (cached) {
    return cached
  }

  // Expensive computation
  const stats = await computeDashboardStats()

  // Cache for 5 minutes
  await ctx.cache.set('dashboard:stats', stats, 300)

  return stats
}
```

## Background Jobs

```typescript
import { dispatch } from '@stacksjs/queue'

export default async function CreateOrder(ctx: FunctionContext) {
  const order = await db
    .insertInto('orders')
    .values(ctx.body)
    .returning('*')
    .executeTakeFirst()

  // Dispatch background jobs
  await dispatch('SendOrderConfirmation', { orderId: order.id })
  await dispatch('NotifyWarehouse', { orderId: order.id })
  await dispatch('UpdateInventory', { items: ctx.body.items })

  return ctx.json(order, 201)
}
```

## Function Configuration

Export a config object to customize function behavior:

```typescript
export default async function MyFunction(ctx: FunctionContext) {
  // Function logic
}

export const config = {
  // Require authentication
  auth: true,

  // Allowed HTTP methods
  methods: ['GET', 'POST'],

  // Rate limiting
  rateLimit: {
    max: 100,
    window: 60,  // seconds
  },

  // Middleware
  middleware: ['logging', 'cors'],

  // Timeout (seconds)
  timeout: 30,
}
```

## Error Handling

```typescript
import { handleError } from '@stacksjs/error-handling'

export default async function RiskyOperation(ctx: FunctionContext) {
  try {
    const result = await performRiskyOperation()
    return result
  }
  catch (error) {
    // Log and handle
    handleError(error, {
      message: 'Risky operation failed',
      shouldExit: false,
    })

    // Return appropriate error response
    if (error instanceof ValidationError) {
      return ctx.error(error.message, 422)
    }

    if (error instanceof NotFoundError) {
      return ctx.error(error.message, 404)
    }

    return ctx.error('Internal server error', 500)
  }
}
```

## Testing Functions

```typescript
// tests/Unit/GetUsersTest.ts
import { describe, expect, it } from 'bun:test'
import GetUsers from '@/Functions/GetUsers'
import { createMockContext } from '@stacksjs/testing'

describe('GetUsers', () => {
  it('returns users list', async () => {
    const ctx = createMockContext()

    const result = await GetUsers(ctx)

    expect(Array.isArray(result)).toBe(true)
  })

  it('filters by query parameter', async () => {
    const ctx = createMockContext({
      query: { role: 'admin' },
    })

    const result = await GetUsers(ctx)

    expect(result.every((u: any) => u.role === 'admin')).toBe(true)
  })
})
```

## Best Practices

### DO

- **Keep functions focused** - One operation per function
- **Validate input** - Never trust user input
- **Handle errors** - Provide meaningful error responses
- **Use types** - Type your context and responses
- **Cache expensive operations** - Reduce database load

### DON'T

- **Don't expose sensitive data** - Filter response fields
- **Don't trust client data** - Always validate server-side
- **Don't block the event loop** - Use async for I/O
- **Don't catch and ignore errors** - Log or handle them

## Related Documentation

- **[API Routes](/guide/routing)** - HTTP routing
- **[Validation](/guide/validation)** - Input validation
- **[Database](/guide/database)** - Database queries
- **[Authentication](/guide/authentication)** - Auth system
- **[Jobs](/basics/jobs)** - Background processing
