# Build Documentation

This tutorial will guide you through building documentation for your Stacks project. Stacks uses BunPress (based on VitePress) to generate beautiful, fast documentation sites from Markdown files.

## Overview

Documentation in Stacks is:

- **Markdown-based** - Write docs in familiar Markdown syntax
- **Automatically served** - Docs are served at your configured path
- **Highly customizable** - Configure navigation, themes, and more
- **SEO-friendly** - Built-in sitemap and meta tag support

## Project Structure

Documentation files live in the `docs/` directory:

```
docs/
├── index.md              # Homepage
├── guide/
│   ├── intro.md         # Getting started
│   └── config.md        # Configuration guide
├── api/
│   ├── actions.md       # Actions reference
│   └── routing.md       # Routing reference
└── _data/               # Shared data files
```

## Setting Up BunPress

### Configuration

Configure your documentation in `config/docs.ts`:

```typescript
// config/docs.ts
import type { BunPressOptions } from '@stacksjs/bunpress'

const config: BunPressOptions = {
  verbose: true,
  docsDir: './docs',
  outDir: './dist/docs',

  // Navigation bar
  nav: [
    {
      text: 'Changelog',
      link: 'https://github.com/your-org/your-repo/blob/main/CHANGELOG.md',
    },
    {
      text: 'Resources',
      items: [
        { text: 'Team', link: '/team' },
        { text: 'Sponsors', link: '/sponsors' },
        { text: 'Contributing', link: '/contributing' },
      ],
    },
  ],

  // Markdown configuration
  markdown: {
    title: 'My Project Documentation',
    meta: {
      description: 'Documentation for My Project',
      author: 'Your Name',
    },
    syntaxHighlightTheme: 'github-dark',
    toc: {
      enabled: true,
      minDepth: 2,
      maxDepth: 3,
    },
    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Introduction', link: '/guide/intro' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Configuration', link: '/guide/config' },
          ],
        },
        {
          text: 'Core Concepts',
          collapsed: true,
          items: [
            { text: 'Routing', link: '/guide/routing' },
            { text: 'Components', link: '/guide/components' },
            { text: 'Actions', link: '/guide/actions' },
          ],
        },
        {
          text: 'API Reference',
          collapsed: true,
          items: [
            { text: 'Actions', link: '/api/actions' },
            { text: 'Router', link: '/api/router' },
            { text: 'Database', link: '/api/database' },
          ],
        },
      ],
    },
    themeConfig: {
      logo: '/images/logo.svg',
      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright 2024-present Your Company.',
      },
      socialLinks: [
        { icon: 'twitter', link: 'https://twitter.com/yourhandle' },
        { icon: 'github', link: 'https://github.com/your-org/your-repo' },
        { icon: 'discord', link: 'https://discord.gg/yourdiscord' },
      ],
    },
  },

  // SEO Configuration
  sitemap: {
    enabled: true,
    baseUrl: 'https://your-domain.com/docs',
  },

  robots: {
    enabled: true,
  },
}

export default config
```

## Writing Markdown

### Basic Syntax

```markdown
# Heading 1
## Heading 2
### Heading 3

Regular paragraph text with **bold**, *italic*, and `inline code`.

- Bullet list item 1
- Bullet list item 2
  - Nested item

1. Numbered list item 1
2. Numbered list item 2

[Link text](https://example.com)

![Image alt text](/images/screenshot.png)
```

### Code Blocks

Use fenced code blocks with language specification:

````markdown
```typescript
// TypeScript code with syntax highlighting
import { route } from '@stacksjs/router'

route.get('/hello', () => {
  return { message: 'Hello, World!' }
})
```
````

### Highlighting Lines

Highlight specific lines in code blocks:

````markdown
```typescript{2,4-6}
import { route } from '@stacksjs/router'

route.get('/hello', () => {         // Line 2 highlighted
  return {
    message: 'Hello, World!',       // Lines 4-6 highlighted
  }
})
```
````

### Custom Containers

Use custom containers for callouts:

```markdown
::: tip
This is a tip or helpful hint.
:::

::: warning
This is a warning to be cautious about.
:::

::: danger
This is a dangerous action or critical warning.
:::

::: info
This is general information.
:::

::: details Click to expand
This content is hidden by default and can be expanded.
:::
```

### Tables

```markdown
| Feature | Supported | Notes |
|---------|-----------|-------|
| Routing | Yes | File-based and explicit |
| Auth | Yes | Token-based |
| Database | Yes | SQLite, MySQL, PostgreSQL |
```

## Frontmatter

Add metadata to your pages using YAML frontmatter:

```markdown
---
title: Getting Started
description: Learn how to get started with My Project
outline: deep
---

# Getting Started

Your content here...
```

### Available Frontmatter Options

```yaml
---
# Page title (used in browser tab and sidebar)
title: Page Title

# Meta description for SEO
description: A brief description of this page

# Control outline depth (false | 'deep' | number)
outline: deep

# Custom layout
layout: home

# Additional head tags
head:
  - - meta
    - name: keywords
      content: stacks, typescript, framework

# Disable features
sidebar: false
aside: false
---
```

## Home Page Layout

Create an attractive home page:

```markdown
---
layout: home
title: My Project
description: A powerful TypeScript framework

hero:
  name: My Project
  text: Build amazing apps with TypeScript
  tagline: Simple, fast, and modern
  image:
    src: /logo.svg
    alt: My Project Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/intro
    - theme: alt
      text: View on GitHub
      link: https://github.com/your-org/your-repo

features:
  - icon: ⚡️
    title: Lightning Fast
    details: Built on Bun for maximum performance
  - icon: 🛠️
    title: Developer Experience
    details: Type-safe, auto-complete everything
  - icon: 📦
    title: Batteries Included
    details: Auth, database, routing, and more built-in
---
```

## Organizing Documentation

### Directory Structure Best Practices

```
docs/
├── index.md                 # Home page
├── guide/                   # User guides
│   ├── intro.md            # Introduction
│   ├── quick-start.md      # Quick start tutorial
│   ├── configuration.md    # Configuration reference
│   └── deployment.md       # Deployment guide
├── api/                     # API reference
│   ├── actions.md          # Actions API
│   ├── router.md           # Router API
│   └── database.md         # Database API
├── examples/                # Example code
│   ├── basic-app.md        # Basic application
│   └── full-stack.md       # Full-stack example
├── team.md                  # Team page
├── sponsors.md              # Sponsors page
└── public/                  # Static assets
    └── images/
        ├── logo.svg
        └── screenshots/
```

### Cross-Referencing

Link between documentation pages:

```markdown
<!-- Relative links -->
See the [configuration guide](./configuration.md) for more details.

<!-- Absolute links (from docs root) -->
Learn about [routing](/guide/routing) first.

<!-- Link to specific heading -->
Check the [validation section](/api/actions#validation).
```

## API Documentation

Document your APIs clearly:

```markdown
# Router API

The router module provides routing functionality for your application.

## Methods

### `route.get(path, handler)`

Register a GET route.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | `string` | The URL path pattern |
| `handler` | `Function \| string` | The route handler |

**Returns:** `Route` - The route instance for chaining

**Example:**

```typescript
import { route } from '@stacksjs/router'

// With inline handler
route.get('/users', () => {
  return User.all()
})

// With action reference
route.get('/users', 'Actions/User/ListUsersAction')
```

### `route.post(path, handler)`

Register a POST route.

<!-- Similar structure for other methods -->
```

## Building and Previewing

### Development Mode

Start the docs development server:

```bash
buddy docs:dev
```

This starts a hot-reloading server, typically at `http://localhost:5173/docs`.

### Building for Production

Build the documentation for production:

```bash
buddy docs:build
```

Output is generated to the `outDir` specified in your config (default: `./dist/docs`).

### Preview Production Build

Preview the production build locally:

```bash
buddy docs:preview
```

## Advanced Configuration

### Custom Theme

Extend the default theme:

```typescript
// config/docs.ts
export default {
  // ...
  markdown: {
    themeConfig: {
      // Custom CSS variables
      customCss: `
        :root {
          --vp-c-brand-1: #646cff;
          --vp-c-brand-2: #747bff;
          --vp-c-brand-3: #9499ff;
        }
      `,
    },
  },
}
```

### Multiple Sidebars

Configure different sidebars for different sections:

```typescript
markdown: {
  sidebar: {
    '/guide/': [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/guide/intro' },
          { text: 'Quick Start', link: '/guide/quick-start' },
        ],
      },
    ],
    '/api/': [
      {
        text: 'API Reference',
        items: [
          { text: 'Actions', link: '/api/actions' },
          { text: 'Router', link: '/api/router' },
        ],
      },
    ],
  },
}
```

### Search Configuration

Enable search functionality:

```typescript
markdown: {
  themeConfig: {
    search: {
      provider: 'local', // Built-in search
      options: {
        translations: {
          button: {
            buttonText: 'Search',
            buttonAriaLabel: 'Search documentation',
          },
        },
      },
    },
  },
}
```

## Deployment

### Static Hosting

The built documentation is static and can be deployed to any static hosting:

- **Vercel**: Connect your repo, set build command to `buddy docs:build`
- **Netlify**: Similar setup with build command
- **GitHub Pages**: Deploy the `dist/docs` folder
- **AWS S3 + CloudFront**: Upload static files

### Integrated with Stacks

Documentation is automatically served by the Stacks server:

```typescript
// config/app.ts
export default {
  // Docs will be available at /docs
  docs: {
    enabled: true,
    path: '/docs',
  },
}
```

## Complete Example

Here is a complete documentation page:

```markdown
---
title: Actions Guide
description: Learn how to create and use actions in your Stacks application
---

# Actions

Actions are reusable units of business logic in Stacks. They can be triggered from routes, CLI commands, events, or other actions.

## Creating an Action

Generate a new action using Buddy:

```bash
buddy make:action SendWelcomeEmail
```

This creates a new file in `app/Actions/SendWelcomeEmail.ts`.

## Action Structure

::: code-group
```typescript [Basic Action]
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'SendWelcomeEmail',
  description: 'Send a welcome email to new users',

  async handle(request) {
    // Your logic here
  },
})
```

```typescript [With Validation]
import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'SendWelcomeEmail',

  validations: {
    email: {
      rule: schema.string().email(),
      message: 'Valid email required',
    },
  },

  async handle(request) {
    const email = request.get('email')
    // Send email
  },
})
```
:::

::: tip
Actions are automatically discovered and registered. You don't need to import them anywhere.
:::

## Using Actions

### From Routes

```typescript
route.post('/welcome', 'Actions/SendWelcomeEmail')
```

### From CLI

Actions can also be triggered from CLI commands:

```typescript
// In a command
await Action.run('SendWelcomeEmail', { email: 'user@example.com' })
```

## Next Steps

- [Validation Guide](/guide/validation) - Learn about input validation
- [Routing Guide](/guide/routing) - Connect actions to routes
- [Testing Actions](/guide/testing-actions) - Write tests for your actions
```

## Next Steps

Now that you know how to build documentation, continue to:

- [Build a CLI](/bootcamp/cli) - Create command-line tools
- [Deployment How-To](/bootcamp/how-to/deploy) - Deploy your documentation

## Related Documentation

- [BunPress Documentation](https://bunpress.dev)
- [VitePress Documentation](https://vitepress.dev)
