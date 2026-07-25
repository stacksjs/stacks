---
name: stacks-shell
description: Use when executing shell commands in a Stacks application — running system commands, process management, or using the shell operator. Covers @stacksjs/shell which wraps Bun's native $ operator.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Shell

## Key Paths
- Core package: `storage/framework/core/shell/src/`
- Source: `storage/framework/core/shell/src/index.ts`
- Package: `@stacksjs/shell`

## API

The entire package is a single re-export of Bun's `$` shell operator:

```typescript
export { $ } from 'bun'
```

## Usage

```typescript
import { $ } from '@stacksjs/shell'

// Run shell commands
await $`ls -la`

// Capture output
const result = await $`git status`
console.log(result.text())

// Set working directory
$.cwd('/path/to/dir')
await $`bun install`

// Pipe commands
await $`cat file.txt | grep "pattern"`

// Environment variables
await $`echo $HOME`
```

## Bun $ Operator Features

- **Template literals** — commands written as tagged template strings
- **Auto-escaping** — interpolated values are safely escaped
- **Streaming** — stdout/stderr can be streamed
- **CWD** — `$.cwd(path)` sets working directory
- **Env** — `$.env(vars)` sets environment variables
- **Quiet mode** — `$.quiet()` suppresses output
- **Throws on error** — non-zero exit codes throw by default

## Gotchas
- **Thin wrapper** — this package literally just re-exports `$` from Bun
- **Server-side only** — shell commands run in the server environment, not in the browser
- **For CLI output formatting, use `@stacksjs/cli`** — this package is for raw command execution
- **Bun-specific** — the `$` operator is a Bun feature, not available in Node.js
- **Used throughout the framework** — build actions, CLI commands, and dev server all use `$` for process execution
