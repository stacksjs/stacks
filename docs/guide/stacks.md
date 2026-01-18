# Stacks Architecture

Stacks is a modular, batteries-included framework built from the ground up in TypeScript with zero external runtime dependencies. This page explains the architecture and how the pieces fit together.

## Core Philosophy

Stacks is built on several key principles:

- **Zero Dependencies** - No external runtime dependencies
- **TypeScript First** - Full type safety everywhere
- **Convention over Configuration** - Sensible defaults, full customization
- **Developer Experience** - Fast feedback, clear errors, excellent tooling
- **Composability** - Use only what you need

## Framework Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Stacks Framework                         │
├─────────────────────────────────────────────────────────────┤
│  Application Layer                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │   Web   │ │   API   │ │ Desktop │ │   CLI   │           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
├───────┴──────────┴──────────┴──────────┴───────────────────┤
│  Core Services                                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ Router │ │  ORM   │ │ Queue  │ │ Cache  │ │  Auth  │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │  Database  │ │   Cloud    │ │  Logging   │              │
│  └────────────┘ └────────────┘ └────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Core Packages

### @stacksjs/router

Type-safe routing for web and API applications.

```typescript
import { router } from '@stacksjs/router'

// Define routes with full type safety
router.get('/users', UserController.index)
router.get('/users/:id', UserController.show)
router.post('/users', UserController.store)

// Route groups with middleware
router.group({ middleware: ['auth'] }, () => {
  router.get('/profile', ProfileController.show)
  router.put('/profile', ProfileController.update)
})

// Resource routes
router.resource('/posts', PostController)
```

### @stacksjs/orm

Eloquent-inspired ORM with full type safety.

```typescript
import { Model, field, hasMany, belongsTo } from '@stacksjs/orm'

class User extends Model {
  static table = 'users'

  static fields = {
    id: field.id(),
    name: field.string(),
    email: field.string().unique(),
    created_at: field.timestamp(),
  }

  static relationships = {
    posts: hasMany(Post),
    profile: hasOne(Profile),
  }
}

// Query with type safety
const users = await User.query()
  .where('active', true)
  .with('posts')
  .orderBy('name')
  .paginate(10)
```

### @stacksjs/queue

Background job processing system.

```typescript
import { Job } from '@stacksjs/queue'

class SendWelcomeEmail extends Job {
  constructor(public user: User) {
    super()
  }

  async handle() {
    await this.user.sendEmail('welcome')
  }

  retries = 3
  backoff = 'exponential'
}

// Dispatch jobs
await SendWelcomeEmail.dispatch(user)

// Delayed jobs
await SendWelcomeEmail.dispatch(user).delay('5 minutes')
```

### @stacksjs/cache

Multi-driver caching system.

```typescript
import { cache } from '@stacksjs/cache'

// Simple caching
await cache.put('key', 'value', '1 hour')
const value = await cache.get('key')

// Remember pattern
const users = await cache.remember('users', '1 hour', async () => {
  return User.all()
})

// Tagged caching
await cache.tags(['users']).put('user:1', user)
await cache.tags(['users']).flush()
```

### @stacksjs/auth

Complete authentication system.

```typescript
import { auth, User } from '@stacksjs/auth'

// Login
const user = await auth.attempt(email, password)
const token = await auth.createToken(user)

// Check authentication
if (auth.check()) {
  const user = auth.user()
}

// Logout
await auth.logout()

// Social authentication
const user = await auth.socialite('github').user()
```

## Application Structure

### Models (app/Models/)

Define your data structures:

```typescript
// app/Models/Post.ts
export default class Post extends Model {
  static table = 'posts'

  static fields = {
    id: field.id(),
    title: field.string(),
    content: field.text(),
    published_at: field.timestamp().nullable(),
    author_id: field.foreignId('users'),
  }

  static relationships = {
    author: belongsTo(User),
    comments: hasMany(Comment),
    tags: belongsToMany(Tag),
  }

  // Computed properties
  get isPublished() {
    return this.published_at !== null
  }

  // Methods
  async publish() {
    this.published_at = new Date()
    await this.save()
  }
}
```

### Controllers (app/Controllers/)

Handle HTTP requests:

```typescript
// app/Controllers/PostController.ts
export class PostController extends Controller {
  async index(request: Request) {
    const posts = await Post.query()
      .with('author')
      .where('published_at', '!=', null)
      .orderBy('published_at', 'desc')
      .paginate(request.query.page)

    return this.json(posts)
  }

  async store(request: Request) {
    const data = await request.validate({
      title: 'required|string|max:200',
      content: 'required|string',
    })

    const post = await Post.create({
      ...data,
      author_id: request.user.id,
    })

    return this.json(post, 201)
  }
}
```

### Actions (app/Actions/)

Encapsulate business logic:

```typescript
// app/Actions/PublishPostAction.ts
export class PublishPostAction extends Action {
  async handle(post: Post) {
    // Validate post is ready
    if (!post.title || !post.content) {
      throw new ValidationError('Post must have title and content')
    }

    // Update post
    post.published_at = new Date()
    await post.save()

    // Dispatch events
    PostPublishedEvent.dispatch(post)

    // Send notifications
    await NotifySubscribersJob.dispatch(post)

    return post
  }
}
```

### Middleware (app/Middleware/)

Process HTTP requests:

```typescript
// app/Middleware/RateLimit.ts
export class RateLimit implements Middleware {
  async handle(request: Request, next: Next) {
    const key = `rate_limit:${request.ip}`
    const limit = 60 // requests per minute

    const current = await cache.increment(key)
    if (current === 1) {
      await cache.expire(key, 60)
    }

    if (current > limit) {
      throw new TooManyRequestsError()
    }

    return next(request)
  }
}
```

## Request Lifecycle

1. **HTTP Request** arrives at the server
2. **Middleware** processes the request (auth, rate limiting, etc.)
3. **Router** matches the request to a route
4. **Controller** handles the request
5. **Actions** execute business logic
6. **Response** is sent back to the client

```
Request → Middleware → Router → Controller → Action → Response
              ↓                      ↓
           Cache                   Model
              ↓                      ↓
           Auth                  Database
```

## Configuration

All configuration lives in the `config/` directory:

```
config/
├── app.ts          # Application settings
├── database.ts     # Database connections
├── cache.ts        # Cache configuration
├── queue.ts        # Queue settings
├── mail.ts         # Email configuration
├── auth.ts         # Authentication
└── services.ts     # Third-party services
```

## Extending Stacks

### Custom Service Providers

```typescript
// providers/StripeServiceProvider.ts
export class StripeServiceProvider extends ServiceProvider {
  register() {
    this.app.singleton('stripe', () => {
      return new Stripe(config('services.stripe.key'))
    })
  }

  boot() {
    // Register webhooks, etc.
  }
}
```

### Custom Commands

```typescript
// commands/SyncInventory.ts
export class SyncInventory extends Command {
  static signature = 'inventory:sync'
  static description = 'Sync inventory with external system'

  async handle() {
    this.info('Syncing inventory...')

    const products = await Product.all()
    for (const product of products) {
      await ExternalService.sync(product)
      this.line(`Synced: ${product.name}`)
    }

    this.success('Inventory sync complete!')
  }
}
```

## Related

- [Introduction](/guide/intro) - Getting started
- [Configuration](/guide/config) - Configuration details
- [Models](/basics/models) - Working with models
- [Routing](/basics/routing) - Route definitions
