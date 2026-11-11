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

## The STX packages: one version, declared by the app

STX is six packages released together at one version: `@stacksjs/stx` (the
runtime), `@stacksjs/components`, `bun-plugin-stx` (the compiler),
`stx-router`, `@stacksjs/desktop` and `@stacksjs/sanitizer`. They pin each
other exactly, so choosing a version of the runtime chooses all six. Two
versions in one app is two runtimes that do not share what they register:
pages render with no routes or components, and the install log says nothing.

An app picks its STX version in its own `package.json`, as ordinary
dependencies, all three on the same version:

```json
{
  "dependencies": { "stacks": "^0.75.540", "@stacksjs/stx": "0.2.851" },
  "devDependencies": { "@stacksjs/components": "0.2.851", "bun-plugin-stx": "0.2.851" }
}
```

The framework's packages ask for the release they were tested against or
newer (`^0.2.842`), so they resolve to the app's copy. **No `overrides` are
needed, and an app should not have any for these packages**: an override
only stops the app choosing a newer STX without editing it too. They used to
be necessary because the framework pinned STX exactly, which gave an app on a
newer patch two copies.

- Raise all three together. Raising one leaves the others behind, and that
  is two versions again.
- `buddy doctor` reports it: `STX packages: one copy, 0.2.851`, or which
  versions are installed and where.
- `buddy upgrade` raises the three to the release the framework was tested
  against when the app is behind it, and leaves a newer one alone.
- An app that declares none of them gets the newest STX the range allows at
  install time. `buddy new` declares them, so a new app is on a tested
  release from the start.

In the framework repository itself, the root `package.json` names the
release exactly and holds every workspace package to it through `overrides`:
a workspace resolves each package's range on its own, and without the hold
the ones the root does not declare took a newer release than the runtime.
`buddy new` removes those overrides from the app it creates. To move the
framework to a new STX release, change the root's three declarations, its
five overrides, and the `^` floor in every `storage/framework/core/*`
manifest to the same version; `tests/declared-dependencies.test.ts` fails on
any that disagree.

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

A Stacks workspace commits two lockfiles with separate ownership:

- `bun.lock` owns the complete JavaScript graph in `node_modules/`.
- `pantry.lock` owns the system toolchain and explicitly declared Pantry
  packages in `pantry/`. It also records workspace declarations, but Pantry
  0.11.102 and later delegates workspace JavaScript installs to the selected
  package manager instead of installing a second npm graph.

Use the published Pantry version pinned by the repository's CI. A normal
install migrates legacy Pantry npm shadows after checking their recorded and
installed identities. Do not remove those entries or directories by hand.
Native platform records can differ between hosts. Review the generated
changes and use the repository's lock guards: an allowed platform addition
does not excuse stale workspace declarations or a lost system-toolchain block.

**Regenerating.** Use the repository's declared, Pantry-managed Bun. Change the
ranges, run `bun install`, then `pantry install --ignore-scripts --quiet`, and
commit both lockfiles with the manifests. These are real dependency installs,
which can download native packages and invoke the JavaScript package manager;
they are not metadata-only operations. The native CLI has no supported
`install --lockfile-only` mode. Pantry 0.11.103 and later forwards
`--ignore-scripts` to the JavaScript package manager as well as suppressing
Pantry project hooks. On 0.11.102 the flag does not suppress JavaScript
lifecycle scripts; use the qualified 0.11.103 or later when that policy matters.
A plain `pantry install` can also activate project services and run
`postDatabaseSetup` or `postSetup` hooks, including migrations and seeding.

The Pantry that writes `pantry.lock` must satisfy the declared `ts-pantry`
range (`@stacksjs/buddy`'s in the framework, the root manifest's in an app),
the version CI installs: another version writes a different lock. A release
checks this before it bumps anything and refuses otherwise; point `PANTRY_BIN`
at a qualified Pantry when the one on PATH is older.

After migration, run `bun install --frozen-lockfile` and
`pantry install --frozen-lockfile --ignore-scripts --quiet`, and verify that
neither committed lockfile changes. Frozen mode rejects a legacy JavaScript
shadow graph that still needs migration; resolve it through the normal install
before checking the frozen graph.

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

## Framework release destination

Framework tags require successful main-push CI for the exact release commit.
Before releasing from a work branch, configure its upstream with
`git branch --set-upstream-to=origin/main`, integrate current main, and use
`bun run release:patch`. The release and standalone bump preflights reject a
framework destination other than main before generating manifests or tags.
Application releases continue to use their own configured upstream.

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
