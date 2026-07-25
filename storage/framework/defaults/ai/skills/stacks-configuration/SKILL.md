---
name: stacks-configuration
description: Use when setting up or modifying Stacks project-level configuration — bunfig.toml preload order, the tsconfig chain and TypeScript 7 / tsgo type checking, workspace configuration, .env setup, package.json scripts, system requirements (Bun >= 1.3.0, SQLite >= 3.47.2), or the project bootstrap process. For individual feature configs (database, email, auth, etc.), see the specific package skills instead.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Project Configuration

Project-level configuration files that control the development environment, build system, and runtime. For feature-specific configs (database, email, auth, etc.), see the corresponding package skill.

## bunfig.toml

```toml
# Order matters: the env layer decrypts .env before the preloader reads it.
preload = [
  "./storage/framework/core/env/plugin.ts",
  "./storage/framework/defaults/resources/plugins/preloader.ts",
]

[test]
preload = [
  "./storage/framework/core/env/plugin.ts",
  "./tests/setup.ts",
]
coverage = false

[run]
bun = true                          # equivalent to `bun --bun` for `bun run`

[serve.static]
plugins = ["bun-plugin-stx"]        # stx template processing for static serves

[install]
registry = { url = "https://registry.npmjs.org/", token = "$BUN_AUTH_TOKEN" }
linker = "hoisted"                  # REQUIRED when using better-dx
```

See `stacks-plugins` for what each preloaded module does, and why some commands
deliberately skip the auto-import graph.

## TypeScript

There is exactly **one** tsconfig in the project root. It extends the framework's
app config, and restates the tunable defaults so you can edit or delete any one
of them:

```
tsconfig.json                                  <- yours; the only one in the root
  extends storage/framework/tsconfig.app.json  <- app paths, include/exclude
    extends storage/framework/tsconfig.base.json  <- every compiler option
```

- Change a line in the root `compilerOptions` to override that option.
- Delete a line to fall back to the framework default.
- Delete the whole block to take the defaults wholesale.

Path aliases, module resolution, and which files get checked are owned by the
framework and update with it.

Framework internals are checked separately by
`storage/framework/tsconfig.framework.json` - do not point your root config at
`storage/framework/**`.

```bash
bun run typecheck:app    # app/, config/, resources/, routes/
bun run typecheck        # framework internals
bun run typecheck:clean  # drop the incremental cache
```

Type checking runs on TypeScript 7 - `tsc` is the native Go compiler (tsgo), so
both checks finish in a couple of seconds. Options removed in 7.0 (`baseUrl`,
`importsNotUsedAsValues`, `preserveValueImports`, `suppressImplicitAnyIndexErrors`)
are gone from every config; path mappings resolve relative to the file that
declares them, so no `baseUrl` is needed.

Incremental build info lands in `storage/framework/.cache/typescript/`, not in
`node_modules`, so it survives a reinstall.

## package.json (Root)

Key sections:
```json
{
  "type": "module",
  "workspaces": [
    "storage/framework/**",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/docs/deps/**",
    "!storage/framework/server/storage/**",
    "!storage/framework/cache/**"
  ],
  "engines": {
    "bun": ">=1.3.0"
  },
  "systemDependencies": {
    "sqlite": ">=3.47.2"
  }
}
```

## .env Setup

```bash
# Required
APP_NAME=MyApp
APP_ENV=local            # local | dev | stage | prod
APP_KEY=                 # generate with: buddy key:generate
APP_URL=http://localhost:3000

# Database
DB_CONNECTION=sqlite     # sqlite | mysql | postgres
DB_DATABASE=database/stacks.sqlite

# Optional (add as needed)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
STRIPE_SECRET_KEY=
MAIL_MAILER=ses
```

## System Requirements
- **Bun** >= 1.3.0 (runtime + package manager)
- **SQLite** >= 3.47.2 (default database)

## Key Project Scripts
```bash
bun run dev          # start dev server
bun run build        # production build
bun run lint         # lint (uses pickier)
bun run test         # run tests
bun run deploy       # deploy to cloud
bun run fresh        # clean reinstall
bun run build:reset  # full clean rebuild
```

## better-dx Integration
- Provides `typescript`, `pickier`, `bun-plugin-dtsx` as peer dependencies
- Do NOT install these separately if `better-dx` is in package.json
- REQUIRES `linker = "hoisted"` in bunfig.toml

## Gotchas
- `bunfig.toml` MUST have `linker = "hoisted"` when better-dx is installed
- **Preload order is load-bearing** — the env plugin decrypts `.env` before the
  preloader reads it. Swapping them breaks encrypted config
- The stx plugin belongs under `[serve.static]`, not `[serve]`
- **One tsconfig in the root.** Adding a second (a `tsconfig.framework.json`, say)
  splits the source of truth. Point scripts at the framework's config by path
  instead
- Workspace excludes prevent `node_modules` and `dist` from being treated as packages
- `.env` is auto-loaded by Bun — no dotenv package needed
- Generate APP_KEY before deployment: `buddy key:generate`
