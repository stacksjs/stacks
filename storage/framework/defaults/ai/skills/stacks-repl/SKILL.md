---
name: stacks-repl
description: Use when working with the Stacks REPL — interactive TypeScript sessions, tinker sessions, debugging, or exploring the framework interactively. Covers @stacksjs/repl and @stacksjs/tinker.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks REPL / Tinker

## Key Paths
- REPL package: `storage/framework/core/repl/src/`
- Tinker package: `storage/framework/core/tinker/src/`
- Packages: `@stacksjs/repl`, `@stacksjs/tinker`

## API

```typescript
import { startRepl } from '@stacksjs/repl'

interface ReplConfig extends TinkerConfig {
  loadFile?: string  // Path to file to preload before starting
}

async function startRepl(config: ReplConfig): Promise<{ exitCode: number }>
```

### How It Works
1. If `config.loadFile` is specified, reads the file content
2. Merges file content into `config.eval` for evaluation
3. Starts an interactive Bun REPL session with all framework modules available
4. Returns the process exit code when the session ends

## Re-exports from @stacksjs/tinker

```typescript
import {
  startTinker,      // Start a tinker session
  tinkerEval,       // Evaluate an expression
  tinkerPrint,      // Print a result
  getHistoryPath,   // Get REPL history file path
  readHistory,      // Read command history
  appendHistory,    // Append to command history
  clearHistory,     // Clear command history
} from '@stacksjs/repl'

import type { TinkerConfig } from '@stacksjs/repl'
```

## CLI Commands

```bash
buddy tinker                    # Start interactive REPL session
buddy tinker --load file.ts     # Preload a file before starting
```

## Usage

Inside the REPL, all framework modules are available:

```typescript
// Query the database
const users = await db.selectFrom('users').get()

// Use models
const post = await Post.find(1)

// Access config
console.log(config.app.name)

// Use faker for quick testing
const email = faker.internet.email()
```

## Gotchas
- **Tinker is the user-facing command, REPL is the engine** — `buddy tinker` calls `startRepl()` under the hood
- **All framework imports available** — models, database, config, faker, etc. are preloaded
- **History is persisted** — REPL history is saved to disk via `getHistoryPath()`
- **File preloading** — use `loadFile` to run setup code before entering interactive mode
- **Bun runtime** — the REPL runs in Bun's JavaScript runtime, not Node.js
