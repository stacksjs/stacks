---
name: stacks-router
description: Use when working with routing in a Stacks application — defining routes, route middleware, route groups, API routes, or the router configuration. Covers @stacksjs/router, routes/ directory, and app/Routes.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Router

The `@stacksjs/router` package provides the framework router, built on `@stacksjs/bun-router`.

## Key Paths
- Core package: `storage/framework/core/router/src/`
- Route definitions: `routes/`
- Application routes: `app/Routes.ts`
- Router types: `storage/framework/types/router.d.ts`
- Dashboard router types: `storage/framework/types/dashboard-router.d.ts`
- Package: `@stacksjs/router`

## Architecture
- Routes are defined in the `routes/` directory
- Application route registration in `app/Routes.ts`
- Built on `@stacksjs/bun-router` with `ts-rate-limiter`
- Supports middleware, validation, and authentication

## Route Types
- API routes
- Web routes
- Dashboard routes
- System tray routes (desktop)

## Features
- HTTP method routing (GET, POST, PUT, DELETE, PATCH)
- Route groups and prefixes
- Middleware application
- Route parameter binding
- Rate limiting (via `ts-rate-limiter`)
- Route model binding

## CLI Commands
- `buddy route` - Route management commands
- `buddy route:list` - List all registered routes

## Dependencies
- `@stacksjs/bun-router` - Core routing engine
- `ts-rate-limiter` - Rate limiting middleware
- `@stacksjs/actions` - Action binding
- `@stacksjs/validation` - Request validation
- `@stacksjs/orm` - Model binding

## Gotchas
- Routes use `@stacksjs/bun-router` under the hood
- Rate limiting is built into the router via `ts-rate-limiter`
- Multiple router type definitions exist for different contexts (web, dashboard, system tray)
- Route validation uses `@stacksjs/validation`
- Route middleware is configured in `app/Middleware.ts`
