---
name: stacks-configuration
description: Use when setting up or modifying Stacks project-level configuration — bunfig.toml settings, tsconfig.json, workspace configuration, .env setup, package.json scripts, system requirements (Bun >= 1.3.0, SQLite >= 3.47.2), or the project bootstrap process. For individual feature configs (database, email, auth, etc.), see the specific package skills instead.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Project Configuration

Project-level configuration files that control the development environment, build system, and runtime. For feature-specific configs (database, email, auth, etc.), see the corresponding package skill.

## bunfig.toml

```toml
[run]
bun = true                    # use bun for all commands

[serve]
plugins = ["bun-plugin-stx"]  # STX template processing

preload = ["./storage/framework/defaults/resources/plugins/preloader.ts"]

[test]
preload = ["./tests/setup.ts"]

[install]
linker = "hoisted"            # REQUIRED when using better-dx
```

## tsconfig.json

Extends the framework's shared config:
```json
{ "extends": "storage/framework/core/tsconfig.json" }
```

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
- The preloader runs before the application starts — initializes plugins
- STX plugin must be in `[serve].plugins` for template processing
- Workspace excludes prevent node_modules and dist from being treated as packages
- `.env` is auto-loaded by Bun — no dotenv package needed
- Generate APP_KEY before deployment: `buddy key:generate`
