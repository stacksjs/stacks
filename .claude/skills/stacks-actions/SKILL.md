---
name: stacks-actions
description: Use when working with Stacks server actions — creating, modifying, or debugging action files in app/Actions/ or storage/framework/core/actions/. Covers action registration, execution patterns, and the actions configuration system.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Actions

Server actions in Stacks provide a way to define reusable server-side logic that can be invoked from routes, commands, or other actions.

## Key Paths
- Core package: `storage/framework/core/actions/src/`
- Application actions: `app/Actions/`
- Default actions: `storage/framework/defaults/actions/`
- Framework actions: `storage/framework/actions/`

## Architecture
- Actions are TypeScript classes or functions exported from `app/Actions/`
- The framework auto-discovers actions and registers them
- Actions can be invoked via `buddy` CLI or programmatically
- Default action categories: AI, Auth, Buddy, Dashboard, Payment, Queue

## Creating an Action
1. Create a new file in `app/Actions/` following existing patterns
2. Export a default function or class
3. Actions receive context with request, config, and utility methods

## Gotchas
- Actions must be ES modules (`export default`)
- The actions discovery system reads from `storage/framework/actions/`
- Always lint with `bunx --bun pickier . --fix` after changes
- Use `@stacksjs/actions` for framework-level action utilities

## Validation
- Run `bun typecheck` to verify action type safety
- Check that action exports match expected signatures
