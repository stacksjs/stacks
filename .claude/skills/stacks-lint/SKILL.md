---
name: stacks-lint
description: Use when linting or formatting code in a Stacks project — running the linter, configuring lint rules, or fixing lint issues. IMPORTANT: Uses pickier, never eslint directly. Covers @stacksjs/lint and config/lint.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Linting

The `@stacksjs/lint` package provides linting tools for the Stacks framework, using **pickier** (never eslint directly).

## Key Paths
- Core package: `storage/framework/core/lint/src/`
- Configuration: `config/lint.ts`
- Pickier tool: ~/Code/Tools/pickier/
- Package: `@stacksjs/lint`

## CRITICAL: Use Pickier, Not ESLint
- **Lint**: `bunx --bun pickier .`
- **Auto-fix**: `bunx --bun pickier . --fix`
- **NEVER** use eslint directly

## Lint Rules
- Configured in `config/lint.ts`
- When fixing unused variable warnings, prefer `// eslint-disable-next-line` comments over prefixing with `_`

## CLI Commands
- `buddy lint` or `bun run lint` - Run linter
- `bun run lint:fix` - Auto-fix issues
- `bun run format` - Format code
- `bun run format:check` - Check formatting

## Gotchas
- ALWAYS use `bunx --bun pickier .` -- never `eslint`
- Pickier is the Stacks linting tool (from ~/Code/Tools/pickier/)
- For unused variables, use `// eslint-disable-next-line` not `_` prefix
- Run lint before committing code
- Lint fix should be run after code generation
