---
name: stacks-development
description: Use when setting up or configuring the Stacks development environment — dev server, hot reload, development utilities, or IDE configuration. Covers the @stacksjs/development package and dev workflow.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Development

The `@stacksjs/development` package provides development utilities for the Stacks framework.

## Key Paths
- Core package: `storage/framework/core/development/src/`
- Dev server: `storage/framework/server/`
- IDE configs: `storage/framework/defaults/ide/`
- Package: `@stacksjs/development`

## Development Commands
- `buddy dev` or `bun run dev` - Start development server
- `buddy fresh` - Fresh installation
- `buddy clean` - Clean build artifacts
- `buddy doctor` - Diagnose issues

## IDE Support
Default IDE configurations for:
- Cursor (`storage/framework/defaults/ide/cursor/`)
- JetBrains (`storage/framework/defaults/ide/jetbrains/`)
- VS Code (`storage/framework/defaults/ide/vscode/`)
- Zed (`storage/framework/defaults/ide/zed/`)

## Development Server
The dev server at `storage/framework/server/` provides:
- Hot module replacement
- Auto-import resolution
- TypeScript compilation
- STX template processing (via `bun-plugin-stx`)

## Gotchas
- The preloader at `storage/framework/defaults/resources/plugins/preloader.ts` runs before dev server
- `bunfig.toml` configures preload scripts and serve plugins
- Port configuration is in `config/ports.ts`
- Dev server uses `bun-plugin-stx` for template processing
