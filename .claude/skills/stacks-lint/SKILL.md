---
name: stacks-lint
description: Use when linting or formatting code in a Stacks project. CRITICAL - always use pickier, NEVER eslint directly. Run 'bunx --bun pickier .' to lint, 'bunx --bun pickier . --fix' to auto-fix. For unused variables, prefer eslint-disable-next-line comments over underscore prefix. Covers @stacksjs/lint and config/lint.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Linting

## CRITICAL RULES
1. **ALWAYS** use `bunx --bun pickier .` to lint -- **NEVER** use `eslint` directly
2. **Auto-fix**: `bunx --bun pickier . --fix`
3. For unused variable warnings: prefer `// eslint-disable-next-line` comments over prefixing with `_`

## Key Paths
- Lint package: `storage/framework/core/lint/` (package: `@stacksjs/lint`)
- Configuration: `config/lint.ts`
- Lint command source: `storage/framework/core/buddy/src/commands/lint.ts`

## Package Details
- Package name: `@stacksjs/lint`
- Version: tracks framework version (currently 0.70.23)
- The lint package is a thin wrapper -- the actual linting is done by pickier
- `storage/framework/core/lint/build.ts` is a no-op (nothing to build)
- Dev dependencies: `better-dx`, `@stacksjs/gitlint`, `bun-git-hooks`

## Commands

### Via buddy CLI
The buddy `lint` command internally runs pickier with the project's pickier config:

```bash
# Lint (runs: bunx --bun pickier run --mode lint --config ./pickier.config.ts)
buddy lint

# Auto-fix (runs: bunx --bun pickier run --mode lint --config ./pickier.config.ts --fix)
buddy lint --fix
buddy lint:fix

# Format (runs: bunx --bun pickier run --mode format --config ./pickier.config.ts --write)
buddy format
buddy format --write        # same as above (write is default)

# Check formatting without changes
buddy format --check        # runs: pickier run --mode format --config ./pickier.config.ts --check
buddy format:check
```

### Direct pickier usage
```bash
# Lint entire project
bunx --bun pickier .

# Auto-fix
bunx --bun pickier . --fix

# Via npm scripts
bun run lint
bun run lint:fix
bun run format
bun run format:check
```

## config/lint.ts (PickierOptions)

The actual configuration used by the project. This is the source of truth for all lint settings:

```typescript
import type { PickierOptions } from 'pickier'

const config: PickierOptions = {
  format: {
    extensions: ['ts', 'js', 'stx', 'json', 'yaml', 'md'],
    indent: 2,
    quotes: 'single',
    semi: false,
  },

  rules: {
    // TypeScript rules
    noDebugger: 'off',
    noConsole: 'off',
  },

  pluginRules: {
    // Regexp rules disabled (false positives on route definitions)
    'regexp/no-unused-capturing-group': 'off',
    'regexp/no-super-linear-backtracking': 'off',
    'regexp/optimal-quantifier-concatenation': 'off',
    // Style rules disabled (conflict with common patterns or generated code)
    'style/brace-style': 'off',
    'style/max-statements-per-line': 'off',
    'style/quotes': 'off',
    'indent': 'off',
    'quotes': 'off',
    // TypeScript rules
    'ts/no-top-level-await': 'off',
    // Console is intentional
    'no-console': 'off',
    // Markdown rules
    'markdown/heading-increment': 'off',
    'markdown/no-empty-links': 'off',
  },

  ignores: [
    '**/fixtures/**',
    '**/coverage/**',
    '**/temp/**',
  ],
}

export default config
```

## Format Settings (enforced)
- **Indent**: 2 spaces
- **Quotes**: single quotes
- **Semicolons**: none (no semicolons)
- **Extensions**: ts, js, stx, json, yaml, md

## Handling Unused Variables

When pickier/eslint reports unused variables, use eslint-disable comments -- do NOT prefix with underscore:

```typescript
// CORRECT: Use eslint-disable comment
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unusedVar = someFunction()

// ALSO CORRECT: Use eslint-disable for next line only
// eslint-disable-next-line no-unused-vars
function handler(req, res, next) {
  res.send('ok')
}

// INCORRECT: Don't prefix with underscore
const _unusedVar = someFunction()  // DON'T DO THIS
```

## Internal Implementation

The buddy `lint` command (in `storage/framework/core/buddy/src/commands/lint.ts`) delegates entirely to pickier:

```typescript
// lint.ts internals
buddy
  .command('lint', 'Automagically lints your project codebase')
  .option('-f, --fix', 'Automagically fixes all lint errors', { default: false })
  .action(async (options: LintOptions) => {
    if (options.fix)
      await runCommand('bunx --bun pickier run --mode lint --config ./pickier.config.ts --fix', { cwd: path.projectPath() })
    else
      await runCommand('bunx --bun pickier run --mode lint --config ./pickier.config.ts', { cwd: path.projectPath() })
  })
```

The `format` command uses pickier in format mode:

```typescript
buddy
  .command('format', 'Format your project codebase')
  .option('-w, --write', 'Write changes to files', { default: false })
  .option('-c, --check', 'Check formatting without making changes', { default: false })
  .action(async (options) => {
    if (options.check)
      await runCommand('bunx --bun pickier run --mode format --config ./pickier.config.ts --check', { cwd: path.projectPath() })
    else
      await runCommand('bunx --bun pickier run --mode format --config ./pickier.config.ts --write', { cwd: path.projectPath() })
  })
```

## Gotchas
- Pickier is the Stacks linting tool -- it wraps eslint with Stacks-specific config
- **NEVER** run `eslint` directly -- always go through `bunx --bun pickier` or `buddy lint`
- The `config/lint.ts` file exports a `PickierOptions` object -- not an eslint config
- The project intentionally allows `console.*` calls (`noConsole: 'off'`, `'no-console': 'off'`)
- The project intentionally allows `debugger` statements (`noDebugger: 'off'`)
- Top-level await is allowed (`'ts/no-top-level-await': 'off'`)
- Brace style and max-statements-per-line rules are disabled to avoid conflicts with generated code
- Run `bunx --bun pickier . --fix` after code generation to clean up
- `buddy lint` exits through the `lint:*` wildcard handler if an invalid sub-command is used
- `buddy format` defaults to `--write` mode (writes changes) unless `--check` is specified
- The lint package (`@stacksjs/lint`) itself has no source files to build -- it is a configuration-only package
