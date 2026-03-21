---
name: stacks-scaffolding
description: Use when generating new code with the Stacks make commands — scaffolding components, functions, migrations, notifications, factories, or other code structures. Covers all buddy make:* commands.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Scaffolding

The `buddy make:*` commands scaffold new code structures following Stacks conventions.

## Available Make Commands
- `buddy make:component` - Create a new STX component
- `buddy make:function` - Create a new function/composable
- `buddy make:migration` - Create a new database migration
- `buddy make:notification` - Create a new notification class
- `buddy make:factory` - Create a model factory for testing
- `buddy make:lang` - Create a new language/locale file
- `buddy make:stack` - Create a new stack

## Command Source
Make commands are in `storage/framework/core/buddy/src/commands/make.ts`

## Default Templates
Templates for generated code are in `storage/framework/defaults/`:
- Components: `defaults/components/`
- Functions: `defaults/functions/`
- Models: `defaults/models/`
- Middleware: `defaults/middleware/`
- Layouts: `defaults/layouts/`
- Views: `defaults/views/`

## Generated File Locations
- Components: `resources/` or component directory
- Functions: `storage/framework/libs/functions/`
- Migrations: `database/`
- Notifications: `app/Notifications/`
- Factories: alongside model definitions
- Language files: `locales/`

## Gotchas
- Always use the make commands for consistent scaffolding
- Generated files follow framework conventions
- Run `bunx --bun pickier . --fix` after generating code
- Templates can be customized in `storage/framework/defaults/`
