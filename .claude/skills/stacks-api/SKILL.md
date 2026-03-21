---
name: stacks-api
description: Use when building, modifying, or debugging API endpoints in a Stacks application — defining routes, handling requests, API middleware, or working with the API server. Covers both @stacksjs/api utilities and the storage/framework/api/ server.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks API

The Stacks API system includes the `@stacksjs/api` utilities package and the `stacks-api` server implementation.

## Key Paths
- Core utilities: `storage/framework/core/api/src/`
- API server: `storage/framework/api/`
- Route definitions: `routes/`
- Application routes: `app/Routes.ts`
- Package: `@stacksjs/api`

## Architecture
- API routes are defined in `routes/` directory
- The API server runs on Bun's HTTP server
- Routes support middleware, validation, and authentication
- API responses are automatically serialized to JSON

## Defining Routes
Routes are defined in the `routes/` directory and registered through `app/Routes.ts`.

## API Server
The API server at `storage/framework/api/` handles:
- Request routing
- Middleware execution
- Authentication verification
- Response formatting
- Error handling

## Gotchas
- API routes use the `@stacksjs/router` under the hood
- Always define response types for API endpoints
- Use the validation package for request validation
- API server ports are configured in `config/ports.ts`
- The API server auto-discovers routes from the `routes/` directory
