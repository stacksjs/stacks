---
name: stacks-buddy
description: Use when working with the Stacks CLI (buddy/bud/stacks/stx) — adding commands, debugging CLI issues, understanding CLI architecture, or extending the buddy runtime. Covers the @stacksjs/buddy package and all 50+ CLI commands.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Buddy CLI

The `@stacksjs/buddy` package is the main CLI runtime for the Stacks framework, providing 50+ commands through the `buddy`, `bud`, `stacks`, and `stx` aliases.

## Key Paths
- Core package: `storage/framework/core/buddy/src/`
- Commands: `storage/framework/core/buddy/src/commands/`
- CLI entry: `buddy` (shell script at project root)
- Application commands: `app/Commands/`
- Package: `@stacksjs/buddy`

## CLI Aliases
All four invoke the same CLI:
- `./buddy <command>`
- `bud <command>`
- `stacks <command>`
- `stx <command>`

## Available Commands (50+)
about, add, auth, build, changelog, clean, cloud, commit, completion, configure, create, deploy, dev, dns, doctor, domains, email, env, fresh, generate, http, install, key, lint, list, mail, maintenance, make, migrate, outdated, package, phone, ports, prepublish, projects, queue, release, route, saas, schedule, search, seed, setup, share, sms, stacks, telemetry, test, tinker

## Make Commands (Scaffolding)
- `buddy make:component` - Create a new component
- `buddy make:function` - Create a new function
- `buddy make:migration` - Create a new migration
- `buddy make:notification` - Create a notification
- `buddy make:factory` - Create a model factory
- `buddy make:lang` - Create a language file
- `buddy make:stack` - Create a new stack

## Adding a New Command
1. Create a file in `storage/framework/core/buddy/src/commands/`
2. Follow the existing command pattern (import from `@stacksjs/cli`)
3. Register in the commands index or lazy-commands.ts

## Gotchas
- Commands in `app/Commands/` are application-level (user-defined)
- Commands in `storage/framework/core/buddy/src/commands/` are framework-level
- Lazy-loaded commands are defined in `lazy-commands.ts`
- The CLI uses `@stacksjs/cli` for command parsing and output
- Always test commands with `bun run ./buddy/src/cli.ts <command>`
