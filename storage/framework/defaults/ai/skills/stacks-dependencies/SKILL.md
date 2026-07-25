---
name: stacks-dependencies
description: Use when managing dependencies in a Stacks project — system dependencies via Pantry, Bun workspaces, buddy-bot updates, better-dx tooling, or dependency configuration. Covers config/deps.ts, Pantry, and workspace management.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Dependencies

## Key Paths
- Root: `package.json`
- Deps config: `config/deps.ts`
- Bun lock: `bun.lock`
- Bun config: `bunfig.toml`

## Pantry Configuration (config/deps.ts)

```typescript
import type { PantryConfig } from 'ts-pantry'

interface PantryConfig {
  dependencies: Record<string, string>   // System-level dependencies
  global: boolean
  services: {
    enabled: boolean
    autoStart: boolean
    database: DatabaseConfig
    postDatabaseSetup: string[]
    frameworks: FrameworkConfig
  }
  preSetup: LifecycleHook
  postSetup: LifecycleHook
  preActivation: LifecycleHook
  postActivation: LifecycleHook
  cache: CacheConfig
  network: NetworkConfig
  security: SecurityConfig
  logging: LoggingConfig
  updates: UpdateConfig
  resources: ResourceConfig
  profiles: ProfileConfig
  verbose: boolean
  installPath: string
  autoInstall: boolean
  installDependencies: boolean
  installBuildDeps: boolean
}
```

### System Dependencies

```typescript
dependencies: {
  bun: '1.3.0',
  sqlite: '3.47.2',
  redis: '7.0.0',
  // ... other system-level requirements
}
```

## Workspace Dependencies

Core packages use `workspace:*` references:

```json
{
  "@stacksjs/auth": "workspace:*",
  "@stacksjs/database": "workspace:*",
  "@stacksjs/router": "workspace:*"
}
```

## Key Framework Dependencies

| Package | Purpose |
|---------|---------|
| `better-dx` | Shared dev tooling (provides `typescript`, `pickier`, `bun-plugin-dtsx`) |
| `bun-query-builder` | Database query building |
| `@stacksjs/ts-auth` | Authentication library |
| `@stacksjs/ts-cloud` | Cloud infrastructure (AWS CDK) |
| `ts-rate-limiter` | Rate limiting |
| `ts-collect` | Collection utilities |
| `ts-mocker` | Fake data generation |
| `ts-slug` | URL slug generation |

## CLI Commands

```bash
buddy add <package>        # Add a dependency
buddy install              # Install dependencies
buddy outdated             # Check for outdated packages
buddy fresh                # Clean + reinstall
bun run upgrade            # Upgrade dependencies
bun run build:reset        # Full reset: rm deps → reinstall → generate → lint → build
```

## Dependency Update System

- **buddy-bot** handles dependency updates — NOT renovatebot
- Automated PR creation for dependency updates
- Configured via `config/buddy-bot.ts`

## Gotchas
- **buddy-bot, not renovatebot** — Stacks uses its own dependency update bot
- **better-dx provides peer deps** — do NOT separately install `typescript`, `pickier`, or `bun-plugin-dtsx` if `better-dx` is present
- **`bunfig.toml` requires `linker = "hoisted"`** when using `better-dx`
- **Pantry manages system deps** — OS-level dependencies like SQLite, Redis, Bun itself
- **Workspace references** — all `@stacksjs/*` packages use `workspace:*` in the monorepo
- **`bun.lock` not `bun.lockb`** — Stacks uses the text-based lockfile format
- **Build reset is destructive** — `bun run build:reset` removes all deps and reinstalls from scratch
