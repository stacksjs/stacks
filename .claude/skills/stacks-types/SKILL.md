---
name: stacks-types
description: Use when working with TypeScript types in the Stacks framework — core type definitions, type utilities, or framework type system. Covers @stacksjs/types and storage/framework/types/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Types

The `@stacksjs/types` package provides core type definitions for the entire Stacks framework.

## Key Paths
- Core package: `storage/framework/core/types/src/`
- Framework types: `storage/framework/types/`
- Package: `@stacksjs/types`

## Framework Type Files
Located in `storage/framework/types/`:
- `actions.d.ts` - Action type definitions
- `auto-imports.d.ts` - Auto-import type declarations
- `attributes.ts` - Model attribute types
- `billing.ts` - Billing/payment types
- `browser-auto-imports.d.ts` - Browser auto-import types (large file)
- `components.d.ts` - Component type declarations
- `dashboard-router.d.ts` - Dashboard routing types
- `env.d.ts` - Environment variable types
- `events.ts` - Event type definitions
- `git.ts` - Git-related types
- `orm-globals.d.ts` - ORM global type declarations
- `reset.d.ts` - Type reset declarations
- `router.d.ts` - Router type definitions
- `server-auto-imports.d.ts` - Server auto-import types
- `shims.d.ts` - Type shims for third-party modules
- `system-tray-router.d.ts` - System tray routing types
- `src/` - Type source files

## CLI Commands
- `bun run typecheck` or `buddy typecheck` - Run TypeScript type checking
- `bun run types:check` - Check types
- `bun run types:fix` - Fix type issues

## Gotchas
- Types is a dependency of most framework packages
- The `browser-auto-imports.d.ts` file is very large (~80KB)
- Type declarations are auto-generated during build
- Always run typecheck after modifying types
- Framework types extend the core types package
