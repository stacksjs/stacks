---
name: stacks-plugins
description: Use when working with the Stacks plugin system — creating plugins, registering plugins, or extending framework functionality via plugins. Covers the @stacksjs/plugins package.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Plugins

The `@stacksjs/plugins` package provides the plugin system for extending Stacks framework functionality.

## Key Paths
- Core package: `storage/framework/core/plugins/src/`
- Default plugins: `storage/framework/defaults/resources/plugins/`
- Preloader: `storage/framework/defaults/resources/plugins/preloader.ts`
- Package: `@stacksjs/plugins`

## Architecture
- Plugins extend framework functionality
- The preloader at `storage/framework/defaults/resources/plugins/preloader.ts` initializes plugins
- Plugins can hook into the build, server, and CLI systems
- Plugin resources are in `storage/framework/defaults/resources/plugins/`

## Plugin Loading
- Plugins are preloaded via `bunfig.toml`: `preload = ["./storage/framework/defaults/resources/plugins/preloader.ts"]`
- The serve plugin `bun-plugin-stx` is loaded for STX template support

## Gotchas
- Plugin preloader runs before the application starts
- STX plugin (`bun-plugin-stx`) is critical for template processing
- Plugins must be compatible with Bun's plugin API
- Framework plugins are separate from application-level middleware
