---
title: Introduction
description: "Stacks is a batteries-included framework for building TypeScript applications. Think of it as the Laravel of TypeScript - a complete ecosystem for building..."
---
# Introduction

Stacks is a batteries-included framework for building TypeScript applications. Think of it as the Laravel of TypeScript - a complete ecosystem for building web apps, APIs, desktop apps, CLIs, and libraries.

## What is Stacks

Stacks provides everything you need to build modern applications:

- **Web Framework** - Build SPAs, SSR apps, or static sites
- **API Builder** - RESTful APIs with automatic route generation
- **ORM** - Type-safe database interactions
- **Authentication** - Complete auth system out of the box
- **Queue System** - Background job processing
- **Real-time** - WebSocket support
- **CLI Tools** - Build command-line applications
- **Desktop Apps** - Native apps with Craft
- **Mobile Apps** - iOS/Android with Capacitor
- **Cloud Deployment** - One-command AWS deployment

## Why Stacks

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
buddy make:model Post

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

- [Pantry](https://pantry.dev), installed with `curl -fsSL https://pantry.dev | bash`
- macOS, Linux, or Windows through WSL2

Run `pantry bootstrap` once. Pantry then provisions Bun 1.3 or newer and the complete Stacks toolchain from the project dependency manifest.
Detailed Pantry behavior is versioned outside Stacks. The whitepaper pins its
[package-manager](https://whitepaper.stacksjs.com/reference/package-manager) and
[registry](https://whitepaper.stacksjs.com/reference/registry) contracts.

### Quick Start

```bash
# Create a new project
panx @stacksjs/buddy new my-app

# Navigate to project
cd my-app

# Start development server
bun run dev
```

Your app is now running at `<http://localhost:3000>`.

### Project Structure

```
my-app/
├── app/                  # Your code
│   ├── Actions/          # Business logic, one file per action
│   ├── Models/           # Data models (defineModel)
│   ├── Jobs/             # Queue jobs
│   ├── Listeners/        # Event listeners
│   ├── Mail/             # Mailable classes
│   ├── Middleware/       # HTTP middleware
│   ├── Commands/         # Custom buddy commands
│   ├── Skills/           # Project-specific AI agent skills
│   ├── Routes.ts         # Registers the files in routes/
│   ├── Events.ts         # Event → listener map
│   ├── Gates.ts          # Authorization gates
│   └── Scheduler.ts      # Scheduled tasks
├── config/               # Typed configuration, one file per subsystem
├── database/
│   └── migrations/       # Generated from your models
├── public/               # Static assets
├── resources/
│   ├── views/            # stx pages
│   ├── components/       # stx components
│   ├── layouts/          # stx layouts
│   └── functions/        # Auto-imported browser functions
├── routes/
│   ├── api.ts            # API routes
│   └── web.ts            # Web routes
├── storage/              # Framework internals, defaults, and runtime state
├── tests/                # Bun test suites
├── AGENTS.md             # Guidance every AI coding agent reads
└── tsconfig.json         # The only tsconfig you own
```

Anything under `app/` overrides the framework's equivalent in
`storage/framework/defaults/app/`. Create `app/Models/User.ts` and it wins over
the built-in one; leave it out and you get the default. That is how 60+ models
and 80+ actions ship usable out of the box while staying fully replaceable.

## Core Concepts

### Models

A model describes its schema, validation, factory, relationships and behavior in
one place. Migrations are generated from it - you never hand-write the SQL.

```typescript
// app/Models/Post.ts
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Post',
  table: 'posts',

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: { count: 20 },
    useApi: { uri: 'posts', routes: ['index', 'store', 'show', 'update', 'destroy'] },
  },

  belongsTo: ['Author'],

  attributes: {
    title: {
      required: true,
      fillable: true,
      validation: { rule: schema.string().min(3).max(255) },
      factory: faker => faker.lorem.sentence(),
    },
    status: {
      fillable: true,
      default: 'draft',
      validation: { rule: schema.enum(['draft', 'published', 'archived']) },
    },
  },
} as const)
```

`useApi` alone generates the five REST actions and their routes. Then:

```bash
buddy generate:migrations   # diff models against the schema
buddy migrate               # apply
```

### Actions

Actions hold your business logic, one per file, and are what routes point at.

```typescript
// app/Actions/SendWelcomeEmail.ts
import { Action } from '@stacksjs/actions'
import { mail, template } from '@stacksjs/email'

export default new Action({
  name: 'SendWelcomeEmail',
  description: 'Sends a welcome email to newly registered users',

  async handle(request) {
    const to = request.get('to')
    const { html, text } = await template('welcome', {
      subject: 'Welcome!',
      variables: { name: request.get('name'), email: to },
    })

    await mail.send({ to, subject: 'Welcome to Stacks!', html, text })

    return { success: true }
  },
})
```

### Routes

Routes live in `routes/` and reference actions by path:

```typescript
// routes/api.ts
import { route } from '@stacksjs/router'

route.get('/posts', 'Actions/PostIndexAction')
route.post('/welcome', 'Actions/SendWelcomeEmail')

route.group({ prefix: '/admin', middleware: ['auth'] }, () => {
  route.get('/stats', 'Actions/Dashboard/StatsAction')
})
```

Models, `response`, and the rest of the framework are auto-imported on the
server, so an action rarely needs an import for them.

### Components

Build your UI with stx components:

```html
<!-- resources/components/InputGroup.stx -->
<script server>
import { defineProps, withDefaults } from 'stx'

interface InputGroupProps {
  id: string
  label: string
  type?: 'text' | 'email' | 'password'
  placeholder?: string
}

const { id, label, type, placeholder } = withDefaults(
  defineProps<InputGroupProps>(),
  { type: 'text', placeholder: '' },
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <label for="{{ id }}">{{ label }}</label>
    <input type="{{ type }}" id="{{ id }}" placeholder="{{ placeholder }}" />
  </div>
</template>
```

Components in `resources/components/` are resolved by name - write
`<InputGroup />` in a view with no import.

## What's Next

1. **[Installation](/guide/get-started)** - Set up your development environment
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
