---
title: Quick Start
---
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

- **API server** at `<http://localhost:3000>`
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
