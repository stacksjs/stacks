---
name: stacks-server
description: Use when working with the Stacks development or production server — server configuration, server middleware, or server startup. Covers @stacksjs/server and storage/framework/server/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Server

The `@stacksjs/server` package provides local development and production server functionality.

## Key Paths
- Core package: `storage/framework/core/server/src/`
- Server implementation: `storage/framework/server/`
- Server source: `storage/framework/server/src/`
- Server Dockerfile: `storage/framework/server/Dockerfile`
- Package: `@stacksjs/server`

## Architecture
- Built on Bun's native HTTP server
- Development server with hot reload
- Production server with optimized settings
- Docker support via included Dockerfile

## Development Server
- Started via `buddy dev` or `bun run dev`
- Auto-reloads on file changes
- Processes STX templates via `bun-plugin-stx`
- Resolves auto-imports for browser and server contexts

## Production Server
- Started via `buddy serve` or `bun run serve`
- Minified and optimized
- Docker deployment supported

## Gotchas
- Server implementation is in `storage/framework/server/`, not just the core package
- The server has its own `package.json`, `tsconfig.json`, and build configuration
- Port configuration is in `config/ports.ts`
- STX template processing requires `bun-plugin-stx`
- The server storage directory is excluded from workspaces
