---
name: stacks-dependencies
description: Use when managing dependencies in a Stacks project — adding packages, updating dependencies, understanding the dependency tree, or working with buddy-bot and pantry. Covers dependency management, better-dx, and workspace dependencies.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Dependencies

Dependency management in the Stacks framework uses Bun workspaces, Pantry, and buddy-bot.

## Key Paths
- Root package.json: `package.json`
- Pantry config: `pantry/`
- Pantry lock: `pantry.lock`
- Bun lock: `bun.lock`
- Deps config: `config/deps.ts`

## Dependency Tools
- **Bun** - Primary package manager and runtime
- **Pantry** - Custom package registry/management tool
- **buddy-bot** - Handles dependency updates (NOT renovatebot)

## CLI Commands
- `buddy add` - Add a dependency
- `buddy install` - Install dependencies
- `buddy outdated` - Check for outdated packages
- `buddy fresh` - Fresh install (clean + install)
- `bun run upgrade` - Upgrade dependencies

## Key Dependencies
- `better-dx` - Shared dev tooling (provides `typescript`, `pickier`, `bun-plugin-dtsx`)
- `bun-query-builder` - Database query building
- `@stacksjs/ts-auth` - Authentication library
- `@stacksjs/ts-cloud` - Cloud infrastructure
- `ts-rate-limiter` - Rate limiting

## Workspace Dependencies
Core packages use `workspace:*` references:
```json
"@stacksjs/auth": "workspace:*"
```

## Gotchas
- **buddy-bot** handles updates, NOT renovatebot
- **better-dx** provides shared dev tooling as peer dependencies
- Do NOT install `typescript`, `pickier`, or `bun-plugin-dtsx` separately if `better-dx` is in `package.json`
- `bunfig.toml` must have `linker = "hoisted"` when using `better-dx`
- Pantry is the custom package manager — check `pantry/` for configuration
- Build reset: `bun run build:reset` (removes deps, reinstalls, regenerates, lints, builds)
