# Introduction

Stacks is a batteries-included framework for building TypeScript applications. Think of it as the Laravel of TypeScript - a complete ecosystem for building web apps, APIs, desktop apps, CLIs, and libraries.

## What is Stacks?

Stacks provides everything you need to build modern applications:

- **Web Framework** - Build SPAs, SSR apps, or static sites
- **API Builder** - RESTful APIs with automatic route generation
- **ORM** - Type-safe database interactions
- **Authentication** - Complete auth system out of the box
- **Queue System** - Background job processing
- **Real-time** - WebSocket support
- **CLI Tools** - Build command-line applications
- **Desktop Apps** - Native apps with Tauri
- **Mobile Apps** - iOS/Android with Capacitor
- **Cloud Deployment** - One-command AWS deployment

## Why Stacks?

### Zero External Dependencies

Stacks is built from the ground up in TypeScript with zero external runtime dependencies. This means:

- Smaller bundle sizes
- Faster performance
- Complete control over the codebase
- No supply chain vulnerabilities

### TypeScript First

Everything is written in TypeScript with full type safety:

```typescript
// Models are fully typed
const user = await User.find(1)
user.name // TypeScript knows this is string

// Routes are type-safe
router.get('/users/:id', async (request) => {
  const id = request.params.id // Typed as string
})

// Validation is type-safe
const data = await request.validate({
  email: 'required|email',
  age: 'required|integer|min:18',
})
// data is typed as { email: string, age: number }
```

### Developer Experience

Stacks prioritizes developer experience:

- **Hot Module Replacement** - Instant feedback during development
- **Automatic Imports** - Components and utilities auto-imported
- **IDE Integration** - Full IntelliSense support
- **Error Messages** - Clear, actionable error messages
- **Documentation** - Comprehensive guides and API docs

### Laravel-Inspired

If you love Laravel, you'll feel at home with Stacks:

```typescript
// Eloquent-style ORM
const posts = await Post.query()
  .with('author', 'comments')
  .where('published', true)
  .orderBy('created_at', 'desc')
  .paginate(15)

// Artisan-style CLI
buddy make:model Post --migration --controller

// Laravel-style routing
router.get('/posts', PostController.index)
router.resource('/users', UserController)

// Middleware
router.group({ middleware: ['auth', 'verified'] }, () => {
  router.get('/dashboard', DashboardController.index)
})
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0 or higher
- macOS, Linux, or Windows (WSL2)

### Quick Start

```bash
# Create a new project
bunx create-stacks my-app

# Navigate to project
cd my-app

# Start development server
bun run dev
```

Your app is now running at `http://localhost:3000`.

### Project Structure

```
my-app/
├── app/
│   ├── Actions/         # Business logic
│   ├── Controllers/     # HTTP controllers
│   ├── Models/          # Database models
│   ├── Events/          # Event classes
│   ├── Jobs/            # Queue jobs
│   └── Middleware/      # HTTP middleware
├── components/          # Vue components
├── config/              # Configuration files
├── database/
│   ├── migrations/      # Database migrations
│   └── seeders/         # Database seeders
├── public/              # Static assets
├── resources/
│   ├── views/           # View templates
│   └── functions/       # Serverless functions
├── routes/
│   ├── api.ts           # API routes
│   └── web.ts           # Web routes
├── storage/             # File storage
└── tests/               # Test files
```

## Core Concepts

### Models

Define your data structures with type-safe models:

```typescript
// app/Models/User.ts
export default class User extends Model {
  static table = 'users'

  static fields = {
    id: field.id(),
    name: field.string(),
    email: field.string().unique(),
    password: field.string().hidden(),
    created_at: field.timestamp(),
  }

  static relationships = {
    posts: hasMany(Post),
    profile: hasOne(Profile),
  }
}
```

### Controllers

Handle HTTP requests:

```typescript
// app/Controllers/UserController.ts
export class UserController extends Controller {
  async index() {
    return User.all()
  }

  async show(request: Request) {
    return User.findOrFail(request.params.id)
  }

  async store(request: Request) {
    const data = await request.validate({
      name: 'required|string',
      email: 'required|email|unique:users',
      password: 'required|min:8',
    })

    return User.create(data)
  }
}
```

### Actions

Encapsulate business logic:

```typescript
// app/Actions/CreateOrderAction.ts
export class CreateOrderAction extends Action {
  async handle(data: OrderData) {
    const order = await Order.create(data)

    await order.calculateTotals()
    await order.sendConfirmationEmail()

    OrderCreatedEvent.dispatch(order)

    return order
  }
}
```

### Components

Build UI with Vue components:

```vue
<!-- components/UserCard.vue -->
<template>
  <div class="user-card">
    <img :src="user.avatar" :alt="user.name">
    <h3>{{ user.name }}</h3>
    <p>{{ user.email }}</p>
    <Button @click="$emit('follow')">Follow</Button>
  </div>
</template>

<script setup lang="ts">
import type { User } from '@/models/User'

defineProps<{
  user: User
}>()

defineEmits<{
  follow: []
}>()
</script>
```

## What's Next?

1. **[Installation](/guide/getting-started)** - Set up your development environment
2. **[Configuration](/guide/config)** - Configure your application
3. **[Routing](/basics/routing)** - Define your routes
4. **[Models](/basics/models)** - Work with your database
5. **[Views](/basics/views)** - Build your UI

## Community

- **GitHub** - [github.com/stacksjs/stacks](https://github.com/stacksjs/stacks)
- **Discord** - Join our community
- **Twitter** - Follow [@stacksjs](https://twitter.com/stacksjs)

## License

Stacks is open-source software licensed under the MIT license.
