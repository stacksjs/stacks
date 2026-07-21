---
title: Stacks Bootcamp
description: "Welcome to the Stacks Bootcamp. This comprehensive series of tutorials will guide you through building applications, APIs, CLIs, desktop apps, and more usi..."
---
# Stacks Bootcamp

Welcome to the Stacks Bootcamp. This comprehensive series of tutorials will guide you through building applications, APIs, CLIs, desktop apps, and more using the Stacks framework.

## What You Will Learn

By the end of this bootcamp, you will have learned how to:

- **Build a Frontend** - Create reactive web applications using STX components, Headwind CSS utility classes, and file-based routing
- **Build an API** - Develop RESTful APIs with routes, actions, controllers, validation, and authentication
- **Build Documentation** - Set up and customize STX documentation sites using BunPress
- **Build a CLI** - Create interactive command-line tools with commands, options, and prompts
- **Build a Desktop App** - Package your stx application with the first-party Craft runtime
- **Deploy to Production** - Configure cloud infrastructure and deploy your applications

## Prerequisites

Before starting, install Pantry and bootstrap its shell integration:

### Required

- **Pantry** - Install with `curl -fsSL https://pantry.dev | bash`
- **Pantry shell integration** - Run `pantry bootstrap` once

Pantry provisions Bun 1.3 or newer, Git, SQLite, and every other tool declared by the project.

### Recommended

- **VS Code** or a similar IDE with TypeScript support
- **AWS CLI** (if deploying to AWS)
- Basic understanding of TypeScript/JavaScript
- Familiarity with HTML and CSS

## Installing Stacks

Get started by creating a new Stacks project:

```bash
# Create a new project through Pantry's package executor
panx @stacksjs/buddy new my-project

# Navigate to your project
cd my-project

# Install the complete declared toolchain and project dependencies
pantry install

# Start the development server
buddy dev
```

## Meet Buddy

Buddy is the Stacks CLI. It is your primary tool for creating, maintaining, and deploying Stacks projects. Throughout this bootcamp, you will use Buddy commands extensively.

```bash
# View all available commands
buddy --help

# Common commands
buddy dev          # Start development server
buddy build        # Build for production
buddy deploy       # Deploy to cloud
buddy test         # Run tests
buddy make:action  # Generate a new action
buddy make:model   # Generate a new model
buddy migrate      # Run database migrations
```

## Project Structure Overview

A Stacks project follows a well-organized directory structure:

```
my-project/
├── app/                    # Application logic
│   ├── Actions/           # Reusable business logic
│   ├── Commands/          # CLI commands
│   ├── Controllers/       # HTTP controllers
│   ├── Jobs/              # Background jobs
│   ├── Middleware/        # HTTP middleware
│   ├── Models/            # Database models
│   └── Notifications/     # Notification classes
│
├── config/                 # Configuration files
│   ├── app.ts             # Application settings
│   ├── auth.ts            # Authentication config
│   ├── cli.ts             # CLI configuration
│   ├── cloud.ts           # Cloud/deployment config
│   ├── database.ts        # Database settings
│   └── docs.ts            # Documentation config
│
├── database/               # Database files
│   └── migrations/        # SQL migration files
│
├── docs/                   # Documentation (markdown)
│
├── public/                 # Static assets
│
├── resources/              # Frontend resources
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # STX components
│   ├── layouts/           # Page layouts
│   ├── views/             # Page views (routes)
│   └── functions/         # Shared functions
│
├── routes/                 # API route definitions
│   └── api.ts             # Main API routes
│
├── storage/                # Application storage
│
├── tests/                  # Test files
│
├── buddy                   # CLI entry point
├── package.json           # Dependencies
└── stx.config.ts          # STX configuration
```

## Configuration Files

Stacks uses TypeScript configuration files in the `config/` directory. All configurations are fully typed for excellent IDE support:

```typescript
// config/app.ts - Example application config
export default {
  name: 'My App',
  env: 'development',
  debug: true,
  url: 'http://localhost:3000',
}
```

## Next Steps

Now that you understand the basics, proceed to the tutorials:

1. [Build a Frontend](/bootcamp/frontend) - Learn STX components and styling
2. [Build an API](/bootcamp/api) - Create RESTful endpoints
3. [Build Documentation](/bootcamp/docs) - Set up your docs site
4. [Build a CLI](/bootcamp/cli) - Create command-line tools
5. [Build a Desktop App](/bootcamp/desktop) - Package as native app

## Resources

- [Stacks Documentation](https://stacksjs.com/docs) - Complete reference
- [GitHub Repository](https://github.com/stacksjs/stacks) - Source code
- [Discord Community](https://discord.gg/stacksjs) - Get help and chat
- [GitHub Discussions](https://github.com/stacksjs/stacks/discussions) - Ask questions

Ready to begin? Start with [building a frontend](/bootcamp/frontend).
