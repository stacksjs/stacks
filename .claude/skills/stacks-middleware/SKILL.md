---
name: stacks-middleware
description: Use when working with HTTP middleware in a Stacks application — creating middleware, applying middleware to routes, or configuring the middleware stack. Covers app/Middleware/ and app/Middleware.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Middleware

HTTP middleware provides request/response processing pipelines for Stacks routes.

## Key Paths
- Application middleware: `app/Middleware/`
- Middleware config: `app/Middleware.ts`
- Default middleware: `storage/framework/defaults/middleware/`
- Auth middleware: `storage/framework/core/auth/src/middleware.ts`

## Architecture
- Middleware processes requests before they reach route handlers
- Response middleware processes after route handlers
- Middleware is registered in `app/Middleware.ts`
- Individual middleware classes go in `app/Middleware/`

## Built-in Middleware
- Authentication middleware (from `@stacksjs/auth`)
- Rate limiting (from `ts-rate-limiter` via router)
- Security middleware (from `@stacksjs/security`)

## Creating Middleware
1. Create a middleware file in `app/Middleware/`
2. Define the `handle()` method
3. Register in `app/Middleware.ts`
4. Apply to routes in route definitions

## Gotchas
- Global middleware is configured in `app/Middleware.ts`
- Route-specific middleware is applied in route definitions
- Middleware execution order matters — defined order is execution order
- Auth middleware is provided by `@stacksjs/auth`
- Default middleware templates are in `storage/framework/defaults/middleware/`
