---
name: stacks-docs
description: Use when building or configuring documentation for a Stacks project — VitePress setup, docs generation, or documentation structure. Covers the @stacksjs/docs package and docs/ directory.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Documentation

The `@stacksjs/docs` package provides documentation system support for Stacks applications, using VitePress.

## Key Paths
- Core package: `storage/framework/core/docs/src/`
- Project docs: `docs/`
- VitePress config: `docs/.vitepress/`
- Framework docs: `storage/framework/docs/`
- Default docs: `storage/framework/defaults/docs/`
- Docs config: `config/docs.ts`
- Package: `@stacksjs/docs`

## Architecture
- Documentation is built with VitePress
- Configuration in `docs/.vitepress/`
- Framework documentation in `storage/framework/docs/`
- Default doc templates in `storage/framework/defaults/docs/`

## Gotchas
- VitePress is the documentation engine (from ~/Code/Tools/vitepress/)
- Documentation configuration is in `config/docs.ts`
- The docs directory has its own `package.json`
- Contributors are listed in `docs/contributors.json`
