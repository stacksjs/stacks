---
name: stacks-routes
description: Use when defining or managing routes in a Stacks application — API routes, web routes, route groups, route parameters, or route listing. Covers the routes/ directory and app/Routes.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Routes

Routes define the HTTP endpoints and their handlers in a Stacks application.

## Key Paths
- Route directory: `routes/`
- Application routes: `app/Routes.ts`
- Router types: `storage/framework/types/router.d.ts`
- Dashboard router types: `storage/framework/types/dashboard-router.d.ts`

## CLI Commands
- `buddy route` - Route management
- `buddy route:list` - List all registered routes

## Route Types
- **API routes** - JSON API endpoints
- **Web routes** - HTML-serving routes
- **Dashboard routes** - Admin dashboard routes
- **System tray routes** - Desktop system tray routes

## Defining Routes
Routes are defined in the `routes/` directory and registered through `app/Routes.ts`.

## Features
- HTTP method binding (GET, POST, PUT, DELETE, PATCH)
- Route parameters and model binding
- Route groups with shared middleware
- Route prefixes
- Named routes

## Gotchas
- Route definitions go in `routes/`, registration in `app/Routes.ts`
- Routes use `@stacksjs/router` under the hood
- Multiple router type files exist for different route contexts
- Rate limiting can be applied per-route
- Middleware is applied via route definitions or `app/Middleware.ts`
