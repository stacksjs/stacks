---
name: stacks-ui
description: Use when working with UI components or the UI engine in a Stacks application — component creation, UI configuration, or the UI rendering system. Covers @stacksjs/ui and config/ui.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks UI

The `@stacksjs/ui` package provides the UI engine for Stacks applications.

## Key Paths
- Core package: `storage/framework/core/ui/src/`
- Configuration: `config/ui.ts`
- Default components: `storage/framework/defaults/components/`
- Default views: `storage/framework/defaults/views/`
- Default layouts: `storage/framework/defaults/layouts/`
- Frontend dist: `storage/framework/frontend-dist/`
- Component types: `storage/framework/types/components.d.ts`
- Package: `@stacksjs/ui`

## Component Categories
Default components in `storage/framework/defaults/components/`:
- Buttons
- Dashboard components
- Documentation components
- Forum components
- Marketing components

## View Categories
Default views in `storage/framework/defaults/views/`:
- Auth views (login, register)
- Dashboard views
- Forum views
- Hello World
- System tray views
- Table views

## Layouts
Default layouts in `storage/framework/defaults/layouts/`:
- Dashboard layouts
- Email layouts
- System tray layouts

## CLI Commands
- `buddy make:component` - Create a new component
- `bun run test:ui` - Run UI tests

## Gotchas
- Use **STX** for templating — never vanilla JS in templates
- Use **crosswind** for CSS (Tailwind-like utilities)
- STX `<script>` tags should only contain stx-compatible code
- Component types are auto-generated in `storage/framework/types/components.d.ts`
- UI configuration is in `config/ui.ts`
