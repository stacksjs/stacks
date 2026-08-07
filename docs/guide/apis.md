---
title: Application APIs
description: "Stacks makes it easy to build robust APIs with automatic route generation, request validation, authentication, and documentation. Create RESTful or GraphQL..."
---
# APIs

Stacks makes it easy to build robust APIs with automatic route generation, request validation, authentication, and documentation. Create RESTful or GraphQL APIs with minimal boilerplate.

## Overview

Stacks API features:

- **Auto-generated routes** - Routes from model definitions
- **Request validation** - Type-safe validation
- **Authentication** - Built-in auth middleware
- **Rate limiting** - Protect against abuse
- **API versioning** - Version your endpoints
- **Documentation** - Auto-generated OpenAPI docs

## Quick Start

### Creating an API

APIs are automatically generated from your models:

```typescript
// app/Models/Post.ts
import { defineModel } from '@stacksjs/orm'

export default defineModel({
  name: 'Post',
  table: 'posts',

  traits: {
    useApi: {
      uri: 'posts',
      routes: ['index', 'show', 'store', 'update', 'destroy'],
    },
  },

  attributes: { /* … */ },
} as const)
```

This generates:

- `GET /api/posts` - List posts
- `GET /api/posts/:id` - Get single post
- `POST /api/posts` - Create post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

## Route Configuration

### Customizing Routes

```typescript
// app/Models/User.ts
export default defineModel({
  name: 'User',

  traits: {
    useApi: {
      // Base URI — routes are served under /api/<uri>
      uri: 'users',

      // Only generate these
      routes: ['index', 'show', 'store'],

      // Applied to every generated route
      middleware: ['auth'],
    },
  },
} as const)
```

### Framework Default Routes

Stacks ships default routes of its own - auth, the admin dashboard's REST
surface, and email webhooks - registered *after* your routes, so anything you
declare yourself always wins.

Pick which of them you mount with `STACKS_DEFAULT_ROUTES`:

```bash
# Auth only: login, register, logout, refresh/revoke, passkeys, 2FA, password reset
STACKS_DEFAULT_ROUTES=auth

# Several bundles
STACKS_DEFAULT_ROUTES=auth,email

# Everything (the default when the variable is unset)
STACKS_DEFAULT_ROUTES=all

# Nothing
STACKS_DEFAULT_ROUTES=none
```

Available bundles are `auth`, `dashboard` and `email`. Unset means all of them,
so an app that says nothing keeps the behaviour it already had.
`STACKS_SKIP_DEFAULT_ROUTES=1` still means "none" and is still supported.

This exists so an app can mount `/login` and 2FA without also mounting the
storefront, reviews, AI and voice routes that share `dashboard.ts`. Before it,
the only way to avoid those was to turn everything off and re-declare the auth
routes by hand, rate limits included.

One asymmetry worth knowing, because it is confusing when you hit it: turning
bundles off stops framework **routes** from registering, but framework
**actions** still resolve. A route you declare yourself can point straight at
one:

```typescript
// routes/api.ts — works with STACKS_DEFAULT_ROUTES=none,
// with no file in app/Actions/
route.post('/login', 'Actions/Auth/LoginAction').rateLimit(5, 'minute')
```

### Manual API Routes

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

route.group({ prefix: '/v1' }, () => {
  route.get('/posts', 'Actions/PostIndexAction')
  route.get('/posts/{id}', 'Actions/PostShowAction')
  route.post('/posts', 'Actions/PostStoreAction')
  route.put('/posts/{id}', 'Actions/PostUpdateAction')
  route.delete('/posts/{id}', 'Actions/PostDestroyAction')

  route.post('/posts/{id}/publish', 'Actions/PostPublishAction')
  route.get('/posts/{id}/comments', 'Actions/CommentIndexAction')
})
```

Routes in `routes/api.ts` are already served under `/api`, so the group above
lands at `/api/v1/posts`. Register route files in `app/Routes.ts`.

## Custom actions

The generated routes cover CRUD. Anything beyond that is an action you write and
point a route at - there is no controller layer.

```typescript
// app/Actions/PostIndexAction.ts
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'PostIndexAction',
  description: 'Lists published posts with their author',

  async handle(request) {
    return Post.with('author')
      .where('status', 'published')
      .orderByDesc('created_at')
      .paginate({
        page: Number(request.query('page') ?? 1),
        perPage: Number(request.query('perPage') ?? 20),
      })
  },
})
```

```typescript
// app/Actions/PostStoreAction.ts
import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'PostStoreAction',
  description: 'Creates a post owned by the authenticated user',

  validations: {
    title: { rule: schema.string().max(200) },
    content: { rule: schema.string() },
  },

  async handle(request) {
    return Post.create({
      title: request.get('title'),
      content: request.get('content'),
      author_id: request.user.id,
    })
  },
})
```

`validations` runs before `handle`, so a failing request never reaches your
logic. Register the action in a route file:

```typescript
// routes/api.ts
route.get('/posts', 'Actions/PostIndexAction')
route.post('/posts', 'Actions/PostStoreAction').middleware(['auth'])
```

### Authentication

```typescript
// app/Actions/Auth/LoginAction.ts
import { Action } from '@stacksjs/actions'
import { Auth } from '@stacksjs/auth'
import { schema } from '@stacksjs/validation'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'LoginAction',
  description: 'Exchanges credentials for an access token',

  validations: {
    email: { rule: schema.string().email() },
    password: { rule: schema.string() },
  },

  async handle(request) {
    const user = await Auth.attempt({
      email: request.get('email'),
      password: request.get('password'),
    })

    if (!user)
      return response.error('Invalid credentials', 401)

    return { user, token: await Auth.createToken(user) }
  },
})
```

Stacks ships these as default actions under
`storage/framework/defaults/app/Actions/Auth/`. Create the same path under
`app/` to override one.

## API Resources

### Transforming Responses

```typescript
// app/Resources/UserResource.ts
import { Resource } from '@stacksjs/http'

export class UserResource extends Resource {
  toArray() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      avatar: this.avatar_url,
      created_at: this.created_at.toISOString(),
      // Don't expose sensitive data
    }
  }

  with() {
    return {
      posts: PostResource.collection(this.posts),
    }
  }
}

// Usage
return UserResource.make(user)
return UserResource.collection(users)
```

### Resource Collections

```typescript
// app/Resources/PostResource.ts
export class PostResource extends Resource {
  toArray() {
    return {
      id: this.id,
      title: this.title,
      excerpt: this.content.substring(0, 200),
      author: new UserResource(this.author),
      created_at: this.created_at.toISOString(),
    }
  }
}

// With pagination
return PostResource.collection(posts).additional({
  meta: { total: posts.total },
})
```

## Pagination

### Automatic Pagination

```typescript
async index(request: Request): Promise<Response> {
  const posts = await Post.query()
    .paginate(request.query.page || 1, request.query.per_page || 15)

  return this.json(posts)
}

// Response:
// {
//   data: [...],
//   meta: {
//     current_page: 1,
//     per_page: 15,
//     total: 100,
//     last_page: 7
//   }
// }
```

### Cursor Pagination

```typescript
const posts = await Post.query()
  .orderBy('created_at', 'desc')
  .cursorPaginate(request.query.cursor, 15)
```

## Rate Limiting

### Route-Level

```typescript
route.group({
  middleware: ['throttle:60,1'], // 60 requests per minute
}, () => {
  route.post('/login', 'Actions/Auth/LoginAction')
})
```

### Custom Rate Limits

```typescript
// app/Middleware/ApiRateLimit.ts
import { RateLimiter, Request, Response, Next } from '@stacksjs/http'

export async function apiRateLimit(
  request: Request,
  response: Response,
  next: Next
) {
  const limiter = new RateLimiter({
    key: request.user?.id || request.ip,
    max: 100,
    window: '15m',
  })

  if (await limiter.exceeded()) {
    return response.json({
      error: 'Too many requests',
      retry_after: await limiter.retryAfter(),
    }, 429)
  }

  await limiter.hit()
  return next()
}
```

## API Versioning

### URL Versioning

```typescript
// routes/api.ts
route.group({ prefix: '/v1' }, () => {
  route.get('/posts', 'Actions/V1/PostIndexAction')
})

route.group({ prefix: '/v2' }, () => {
  route.get('/posts', 'Actions/V2/PostIndexAction')
})
```

### Header Versioning

```typescript
// app/Middleware/ApiVersion.ts
export async function apiVersion(request: Request, response: Response, next: Next) {
  const version = request.header('Accept-Version') || 'v1'

  request.apiVersion = version

  return next()
}
```

## Error Handling

### API Error Responses

```typescript
// app/Exceptions/Handler.ts
import { ExceptionHandler, HttpException } from '@stacksjs/http'

export class Handler extends ExceptionHandler {
  render(exception: Error, request: Request): Response {
    if (request.wantsJson()) {
      if (exception instanceof HttpException) {
        return response.json({
          error: exception.message,
          status: exception.statusCode,
        }, exception.statusCode)
      }

      return response.json({
        error: 'Internal server error',
        status: 500,
      }, 500)
    }

    return super.render(exception, request)
  }
}
```

### Custom Exceptions

```typescript
import { HttpException } from '@stacksjs/http'

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string) {
    super(`${resource} not found`, 404)
  }
}

// Usage
throw new ResourceNotFoundException('Post')
```

## API Documentation

### OpenAPI Generation

```bash
# Generate OpenAPI spec
buddy generate:openapi-spec
```

### Annotating Endpoints

```typescript
/**

 _ @api {get} /posts List posts
 _ @apiGroup Posts
 _ @apiQuery {number} page Page number
 _ @apiQuery {number} per_page Items per page
 _ @apiSuccess {Post[]} data List of posts

 _/
async index(request: Request): Promise<Response> {
  // ...
}
```

## Testing APIs

```typescript
import { describe, it, expect } from 'bun:test'
import { http, useTransaction } from '@stacksjs/testing'

describe('Posts API', () => {
  useTransaction()

  it('lists posts', async () => {
    const response = await http.get('/api/posts')

    expect(response.status).toBe(200)
    expect(response.json().data).toBeArray()
  })

  it('requires authentication', async () => {
    const response = await http.post('/api/posts', {
      body: { title: 'Test' },
    })

    expect(response.status).toBe(401)
  })
})
```

## Best Practices

1. **Use resources** - Transform responses consistently
2. **Validate all input** - Never trust client data
3. **Version your API** - Plan for future changes
4. **Rate limit** - Protect against abuse
5. **Document endpoints** - Generate OpenAPI specs
6. **Handle errors gracefully** - Return meaningful error messages

## Related

- [Routing](/basics/routing) - Route definitions
- [Models](/basics/models) - Data models
- [Authentication](/guide/auth) - Auth system
- [Middleware](/basics/middleware) - Request middleware
