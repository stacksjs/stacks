# Terminology

This glossary defines the key terms and concepts used throughout Stacks documentation.

## Core Concepts

### Stacks

The overall framework ecosystem. Stacks is a batteries-included TypeScript framework for building web applications, APIs, libraries, and more.

### Buddy

The command-line interface (CLI) for Stacks. Buddy provides commands for development, building, testing, and deployment. Named for being your development companion.

```bash
buddy dev        # Start development server
buddy build      # Build for production
buddy deploy     # Deploy to cloud
```

### Stack

A complete project created with Stacks. A stack includes your application code, configuration, and all associated resources.

## Architecture

### Model-View-Action (MVA)

The architectural pattern used by Stacks:

- **Model** - Data structures and database interactions
- **View** - User interface components and templates
- **Action** - Business logic encapsulated in dedicated classes

### Actions

Single-purpose classes that encapsulate business logic. Actions are the "A" in MVA and provide testable, reusable operations.

```typescript
class CreateOrderAction extends Action {
  async handle(data: OrderData) {
    // Business logic here
  }
}
```

### Controllers

Classes that handle HTTP requests and delegate to Actions. Controllers are thin and focus on request/response handling.

### Middleware

Functions that process requests before they reach controllers. Used for authentication, logging, rate limiting, etc.

## Components

### Components

Reusable Vue.js UI components. Can be Vue Single File Components (SFCs) or Web Components.

### Web Components

Framework-agnostic custom elements built from Vue components. Work in any HTML context.

### Composables

Reusable composition functions that encapsulate stateful logic. Following Vue 3's Composition API pattern.

```typescript
const { count, increment } = useCounter()
```

## Functions

### Functions

Reusable TypeScript utilities. Pure functions that can be shared across projects.

### Helpers

Utility functions provided by the framework for common tasks.

## Database

### ORM (Object-Relational Mapping)

The system that maps TypeScript classes to database tables. Stacks provides an Eloquent-inspired ORM.

### Models

TypeScript classes that represent database tables and define fields, relationships, and behaviors.

### Migrations

Version-controlled database schema changes. Allow you to evolve your database structure over time.

```typescript
class CreateUsersTable extends Migration {
  async up() {
    await this.schema.create('users', (table) => {
      table.id()
      table.string('name')
      table.timestamps()
    })
  }
}
```

### Seeders

Classes that populate your database with test or initial data.

### Factories

Classes that generate fake model instances for testing.

## Routing

### Routes

Definitions that map URLs to controller methods or actions.

### Route Groups

Collections of routes that share common attributes like middleware or prefixes.

### Resource Routes

Automatically generated CRUD routes for a model.

## Authentication

### Guards

Authentication drivers that determine how users are authenticated (session, token, etc.).

### Providers

Services that retrieve users from storage (database, API, etc.).

### Policies

Classes that define authorization rules for specific models or resources.

## Queue System

### Jobs

Units of work that can be processed asynchronously in the background.

### Queues

Named channels where jobs are stored until processed.

### Workers

Processes that consume jobs from queues and execute them.

## Caching

### Cache Store

The storage backend for cached data (memory, Redis, file, etc.).

### Cache Tags

Labels that allow you to group and invalidate related cache entries.

## Events

### Events

Objects that represent something that happened in your application.

### Listeners

Handlers that respond to events when they occur.

### Subscribers

Classes that define multiple event handlers in one place.

## Cloud & Deployment

### Cloud

The infrastructure management system for deploying Stacks applications to AWS.

### CDK (Cloud Development Kit)

AWS tool used by Stacks to define cloud infrastructure as code.

### Lambda

AWS serverless compute service where Stacks applications can run.

### CloudFront

AWS CDN service for distributing static assets globally.

## Libraries

### Library

A reusable package of components and/or functions that can be published to npm.

### Composability

Design principle where small, focused pieces combine to create complex functionality.

### Atomic Design

Design methodology that builds interfaces from small, reusable pieces (atoms) up to complete pages.

## UI Concepts

### UI Engine

The system that powers component rendering and styling in Stacks.

### Desktop Engine

The Tauri-based system for building native desktop applications.

### Mobile Engine

The Capacitor-based system for building iOS and Android applications.

## Development

### HMR (Hot Module Replacement)

Development feature that updates code in the browser without full page reload.

### Type Generation

Automatic creation of TypeScript type definitions from your code.

### Auto-imports

Automatic importing of components and functions without explicit import statements.

## Testing

### Unit Tests

Tests for individual functions or components in isolation.

### Feature Tests

Tests for complete features or user flows.

### Browser Tests

End-to-end tests that run in a real browser.

## Configuration

### Config

The `config/` directory containing application settings.

### Environment Variables

External configuration values set in `.env` files or the deployment environment.

### Providers

Services registered in the application that provide functionality.

## Build System

### Build

The process of compiling and bundling code for production.

### Bundle

The compiled output files ready for deployment.

### Tree Shaking

Optimization that removes unused code from bundles.

## Package Management

### Bun

The JavaScript runtime and package manager used by Stacks.

### Package

A distributable unit of code, typically published to npm.

### Dependency

An external package required by your application.

## Version Control

### Conventional Commits

Commit message format that enables automatic changelog generation.

### Semantic Versioning

Version numbering scheme (MAJOR.MINOR.PATCH) indicating compatibility.

### Release

A published version of your application or library.
