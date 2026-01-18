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
import { Model } from '@stacksjs/orm'

export default class Post extends Model {
  static api = {
    routes: ['index', 'show', 'store', 'update', 'destroy'],
  }

  // Fields, relationships, etc.
}
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
export default class User extends Model {
  static api = {
    // Only specific routes
    routes: ['index', 'show', 'store'],

    // Custom route prefix
    prefix: '/users',

    // Middleware
    middleware: ['auth'],

    // Rate limiting
    rateLimit: {
      max: 100,
      window: '15m',
    },
  }
}
```

### Manual API Routes

```typescript
// routes/api.ts
import { router } from '@stacksjs/router'
import { PostController } from '@/controllers/PostController'

router.group({ prefix: '/api/v1' }, () => {
  router.get('/posts', PostController.index)
  router.get('/posts/:id', PostController.show)
  router.post('/posts', PostController.store)
  router.put('/posts/:id', PostController.update)
  router.delete('/posts/:id', PostController.destroy)

  // Custom actions
  router.post('/posts/:id/publish', PostController.publish)
  router.get('/posts/:id/comments', PostController.comments)
})
```

## Controllers

### Resource Controller

```typescript
// app/Controllers/PostController.ts
import { Controller, Request, Response } from '@stacksjs/http'
import { Post } from '@/models/Post'

export class PostController extends Controller {
  async index(request: Request): Promise<Response> {
    const posts = await Post.query()
      .with('author')
      .paginate(request.query.page, request.query.perPage)

    return this.json(posts)
  }

  async show(request: Request): Promise<Response> {
    const post = await Post.query()
      .with('author', 'comments')
      .findOrFail(request.params.id)

    return this.json(post)
  }

  async store(request: Request): Promise<Response> {
    const validated = await request.validate({
      title: 'required|string|max:200',
      content: 'required|string',
      published: 'boolean',
    })

    const post = await Post.create({
      ...validated,
      author_id: request.user.id,
    })

    return this.json(post, 201)
  }

  async update(request: Request): Promise<Response> {
    const post = await Post.findOrFail(request.params.id)

    await this.authorize('update', post)

    const validated = await request.validate({
      title: 'string|max:200',
      content: 'string',
      published: 'boolean',
    })

    await post.update(validated)

    return this.json(post)
  }

  async destroy(request: Request): Promise<Response> {
    const post = await Post.findOrFail(request.params.id)

    await this.authorize('delete', post)
    await post.delete()

    return this.noContent()
  }
}
```

## Request Validation

### Inline Validation

```typescript
async store(request: Request): Promise<Response> {
  const data = await request.validate({
    email: 'required|email|unique:users,email',
    password: 'required|min:8|confirmed',
    name: 'required|string|max:100',
    role: 'in:admin,user,moderator',
  })

  // data is typed and validated
}
```

### Form Request Classes

```typescript
// app/Requests/CreateUserRequest.ts
import { FormRequest } from '@stacksjs/http'

export class CreateUserRequest extends FormRequest {
  rules() {
    return {
      email: 'required|email|unique:users,email',
      password: 'required|min:8|confirmed',
      name: 'required|string|max:100',
    }
  }

  messages() {
    return {
      'email.unique': 'This email is already registered',
      'password.min': 'Password must be at least 8 characters',
    }
  }

  authorize(): boolean {
    return true // Or check permissions
  }
}

// Usage
async store(request: CreateUserRequest): Promise<Response> {
  const data = await request.validated()
  // ...
}
```

## Authentication

### Protecting Routes

```typescript
// routes/api.ts
router.group({ middleware: ['auth:api'] }, () => {
  router.get('/profile', ProfileController.show)
  router.put('/profile', ProfileController.update)
})
```

### Token Authentication

```typescript
// app/Controllers/AuthController.ts
import { Controller, Request, Response } from '@stacksjs/http'
import { Auth } from '@stacksjs/auth'

export class AuthController extends Controller {
  async login(request: Request): Promise<Response> {
    const { email, password } = await request.validate({
      email: 'required|email',
      password: 'required',
    })

    const user = await Auth.attempt(email, password)

    if (!user) {
      return this.json({ error: 'Invalid credentials' }, 401)
    }

    const token = await Auth.createToken(user)

    return this.json({ user, token })
  }

  async logout(request: Request): Promise<Response> {
    await Auth.revokeToken(request.bearerToken())

    return this.noContent()
  }

  async me(request: Request): Promise<Response> {
    return this.json(request.user)
  }
}
```

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
router.group({
  middleware: ['throttle:60,1'], // 60 requests per minute
}, () => {
  router.post('/api/login', AuthController.login)
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
router.group({ prefix: '/api/v1' }, () => {
  router.get('/posts', PostControllerV1.index)
})

router.group({ prefix: '/api/v2' }, () => {
  router.get('/posts', PostControllerV2.index)
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
buddy api:docs

# Serve documentation UI
buddy api:docs --serve
```

### Annotating Endpoints

```typescript
/**
 * @api {get} /posts List posts
 * @apiGroup Posts
 * @apiQuery {number} page Page number
 * @apiQuery {number} per_page Items per page
 * @apiSuccess {Post[]} data List of posts
 */
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
- [Authentication](/basics/authentication) - Auth system
- [Middleware](/basics/middleware) - Request middleware
