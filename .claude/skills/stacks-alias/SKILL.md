---
name: stacks-alias
description: Use when working with path aliases in a Stacks project — configuring, resolving, or debugging import path aliases. Covers the @stacksjs/alias package that manages TypeScript path resolution.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Path Aliases

The `@stacksjs/alias` package manages path aliases for the Stacks framework, ensuring consistent import resolution across the monorepo.

## Key Paths
- Core package: `storage/framework/core/alias/src/`
- Package: `@stacksjs/alias`

## Purpose
- Provides path alias resolution for the Stacks monorepo
- Maps `@stacksjs/*` imports to their workspace locations
- Integrates with TypeScript's `paths` configuration
- Used by the build system for consistent module resolution

## How Aliases Work
- Aliases are defined based on workspace package locations
- The `tsconfig.json` at root extends `storage/framework/core/tsconfig.json`
- Bun's module resolution uses these aliases at runtime
- Build tools resolve aliases to actual paths for production bundles

## Gotchas
- Always use `@stacksjs/*` imports, not relative paths between packages
- The alias system depends on the monorepo workspace configuration
- Changes to aliases require a build system restart during development
- Check `bunfig.toml` for preload and plugin configurations that affect resolution
