---
title: Quick Start
---

# Quick Start

This guide will help you get up and running with Stacks in just a few minutes. By the end, you will have a working application with an API route and a component.

## Prerequisites

Before you begin, ensure you have:

- [Bun](https://bun.sh) installed (v1.1.29 or later)
- A code editor (VS Code recommended with the Stacks extension)
- Basic knowledge of TypeScript

## Installation

Create a new Stacks project using the following command:

```bash
bun create stacks my-app
```

This command will:

1. Scaffold a new Stacks project in the `my-app` directory
2. Install all dependencies automatically
3. Configure your development environment

Once complete, navigate to your new project:

```bash
cd my-app
```

## Project Structure

Your new Stacks project has the following structure:

```
my-app/
├── app/
│   ├── Actions/           # Business logic and API handlers
│   ├── Commands/          # CLI commands
│   ├── Controllers/       # HTTP controllers
│   ├── Jobs/              # Background jobs
│   ├── Middleware/        # Request middleware
│   ├── Models/            # Database models
│   ├── Notifications/     # Notification classes
│   ├── Policies/          # Authorization policies
│   ├── Gates.ts           # Authorization gates
│   ├── Middleware.ts      # Middleware aliases
│   └── Routes.ts          # Route file registry
├── config/                # Application configuration
├── database/
│   └── migrations/        # Database migrations
├── public/                # Static assets
├── resources/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # UI components (.stx files)
│   ├── functions/         # Composable functions
│   ├── layouts/           # Layout templates
│   └── views/             # Page views (.stx files)
├── routes/
│   └── api.ts             # API route definitions
├── storage/               # Application storage
├── tests/                 # Test files
├── .env                   # Environment variables
├── package.json           # Dependencies and scripts
└── buddy                  # Stacks CLI
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `app/Actions` | Contains your business logic. Actions can be used as API handlers, CLI commands, job workers, and more. |
| `app/Middleware` | Request/response middleware for authentication, logging, rate limiting, etc. |
| `app/Models` | Database model definitions with relationships and validation rules. |
| `resources/components` | Reusable UI components using `.stx` syntax (HTML + minimal JS). |
| `resources/views` | Page templates and layouts. |
| `routes/` | API and web route definitions. |
| `config/` | All application configuration files. |

## Your First API Route

Open `routes/api.ts` and add a simple route:

```typescript
import { route, response } from '@stacksjs/router'

// A simple GET route
route.get('/hello', () => response.json({ message: 'Hello, World!' }))

// A route with parameters
route.get('/users/{id}', (request) => {
  const id = request.params.id
  return response.json({ userId: id })
})

// Using an Action handler
route.post('/subscribe', 'Actions/SubscribeAction')
```

### Creating an Action

Actions are the backbone of your application logic. Create a new action in `app/Actions/SubscribeAction.ts`:

```typescript
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'SubscribeAction',
  description: 'Handle newsletter subscription',
  method: 'POST',

  // Validation rules
  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Please provide a valid email address.',
    },
    name: {
      rule: schema.string().min(2).max(100),
      message: 'Name must be between 2 and 100 characters.',
    },
  },

  async handle(request) {
    const email = request.get('email')
    const name = request.get('name')

    // Your business logic here
    // e.g., save to database, send confirmation email

    return response.json({
      success: true,
      message: `Thanks for subscribing, ${name}!`,
    })
  },
})
```

## Your First Component

Stacks uses `.stx` files for components, which combine HTML with minimal JavaScript in an intuitive syntax.

Create a new component in `resources/components/WelcomeCard.stx`:

```html
<script server>
// Props with defaults
const title = props.title || 'Welcome'
const description = props.description || 'Get started with Stacks'
const showButton = props.showButton ?? true
</script>

<div class="rounded-lg bg-white p-6 shadow-md">
  <h2 class="text-2xl font-bold text-gray-900">{{ title }}</h2>
  <p class="mt-2 text-gray-600">{{ description }}</p>

  @if(showButton)
    <button
      class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
    >
      Get Started
    </button>
  @endif
</div>
```

### Using Your Component

Use the component in any view or other component:

```html
<WelcomeCard
  title="Hello, Developer!"
  description="Start building amazing things with Stacks."
  :showButton="true"
/>
```

## Running the Development Server

Start your development server with:

```bash
./buddy dev
```

Or use the npm script:

```bash
bun run dev
```

This will start:

- **API server** at `http://localhost:3000`
- **Frontend dev server** with hot module replacement
- **File watchers** for automatic rebuilds

### Other Useful Commands

```bash
# Run tests
./buddy test

# Lint your code
./buddy lint

# Format code
./buddy format

# Generate types
./buddy generate

# Build for production
./buddy build

# Deploy to cloud
./buddy deploy
```

## Next Steps

Now that you have a working Stacks application, explore these topics:

- [Routing](/basics/routing) - Learn about file-based and programmatic routing
- [Middleware](/basics/middleware) - Add authentication, logging, and more
- [Models](/basics/models) - Define your database schema and relationships
- [Actions](/basics/actions) - Build reusable business logic
- [Components](/basics/components) - Create interactive UI components

## Getting Help

If you need help:

- Check the [full documentation](/)
- Join the [Stacks Discord Server](https://discord.gg/stacksjs)
- Open an issue on [GitHub](https://github.com/stacksjs/stacks/issues)
- Browse [GitHub Discussions](https://github.com/stacksjs/stacks/discussions)

Happy coding with Stacks!
