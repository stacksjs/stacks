---
title: Quick Start
description: This guide takes you from zero to a running Stacks application in a few minutes.
---

# Quick Start

This guide takes you from zero to a running Stacks application in a few minutes.

## Prerequisites

- [Pantry](https://pantry.dev) - install with `curl -fsSL https://pantry.dev | bash`, then run `pantry bootstrap`
- macOS, Linux, or Windows through WSL2

Pantry provisions Bun 1.3 or newer, Git, SQLite, and the rest of the project toolchain from the versioned Stacks dependency manifest.
Stacks pins the upstream Pantry behavior it relies on; consult the source-linked
[package-manager](https://whitepaper.stacksjs.com/reference/package-manager) and
[registry](https://whitepaper.stacksjs.com/reference/registry) contracts for
resolution, integrity, authentication, storage, and failure semantics.

## Create a New Project

```bash
panx @stacksjs/buddy new my-app
```

The installer downloads the project template. Buddy and Pantry then install the declared machine and project dependencies, create your `.env` file, and generate an application key.

## Start Developing

```bash
cd my-app
./buddy dev
```

This starts:

- **API server** at `http://localhost:3000`
- **Frontend dev server** with hot module replacement
- **File watchers** for automatic rebuilds

If anything looks off, run `./buddy doctor` - it checks your Bun version, environment file, application key, database connectivity, and more.

## Your First Action

Actions hold your business logic. Create `app/Actions/SubscribeAction.ts`:

```ts
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

<div class="p-6 bg-white rounded-lg shadow-md">
  <h2 class="font-bold text-2xl text-gray-900">{{ title }}</h2>
  <p class="mt-2 text-gray-600">{{ description }}</p>

  @if(showButton)
    <button
      class="mt-4 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md"
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

## Other Useful Commands

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

Run `./buddy --help` for the full command list.

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
