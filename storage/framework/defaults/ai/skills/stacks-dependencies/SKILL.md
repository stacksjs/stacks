---
name: stacks-dependencies
description: Use when managing dependencies in a Stacks project - system dependencies via Pantry, Bun workspaces, buddy-bot updates, better-dx tooling, or dependency configuration. Covers config/deps.ts, Pantry, and workspace management.
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

## Lockfiles

A Stacks project commits two lockfiles, and they describe one tree:

- `bun.lock` resolves `node_modules/`, which the app root reads.
- `pantry.lock` records the system toolchain (Bun itself, SQLite, curl, git)
  **and** every npm package, which `pantry/` holds and the framework source
  resolves from.

Since pantry 0.11.65 an npm range resolves to `bun.lock`'s pin whenever that
pin satisfies it, so the two agree on every package they both name. Since
0.11.60 the file is platform-independent: `pantry install` on macOS writes what
CI writes on Linux, foreign-platform records included.

**Regenerating.** Change the ranges, run `bun install`, then `pantry install`,
on any platform, and commit `bun.lock` and `pantry.lock` with the manifests.
Check `head -2 bun.lock` says `lockfileVersion: 2`; an older Bun on PATH
downgrades it.

**Who else writes them.**

- `buddy release` regenerates both and refuses to commit a `pantry.lock` that
  violates a range it records or drops the root `system` block.
- The dependency bot (`@buddysh/buddy` 0.11.5+, via `better-dx`) runs
  `pantry install` after the JS manager on its Linux runner, so dependency pull
  requests arrive with both lockfiles current.

**The guards.** CI's `compile` job installs and fails if either lockfile
changed, and `lockfile-matches-manifests.test.ts` compares the ranges both
lockfiles record against the manifests. Either failure means a lockfile was
not regenerated with its manifest, not that the guard is wrong.

## Dependency Update System

- **buddy-bot** (`@buddysh/buddy`, shipped by `better-dx`) handles dependency updates, NOT renovatebot
- Automated PR creation for dependency updates, run as `bunx @buddysh/buddy` in `.github/workflows/buddy-bot.yml`
- Configured via `config/buddy-bot.ts` (read as the pre-rename fallback for `config/buddy.ts`, which in a Stacks app would read as the Stacks CLI's config)

## Gotchas
- **buddy-bot, not renovatebot** — Stacks uses its own dependency update bot
- **better-dx provides peer deps** — do NOT separately install `typescript`, `pickier`, or `bun-plugin-dtsx` if `better-dx` is present
- **`bunfig.toml` requires `linker = "hoisted"`** when using `better-dx`
- **Pantry manages system deps** — OS-level dependencies like SQLite, Redis, Bun itself
- **Workspace references** — all `@stacksjs/*` packages use `workspace:*` in the monorepo
- **`bun.lock` not `bun.lockb`** — Stacks uses the text-based lockfile format
- **Build reset is destructive** — `bun run build:reset` removes all deps and reinstalls from scratch
