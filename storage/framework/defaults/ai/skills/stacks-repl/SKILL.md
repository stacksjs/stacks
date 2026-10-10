---
name: stacks-repl
description: Use when working with the Stacks REPL - interactive TypeScript sessions, tinker sessions, debugging, or exploring the framework interactively. Covers @stacksjs/repl and @stacksjs/tinker.
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

async function startRepl(config?: ReplConfig): Promise<{ exitCode: number }>
```

### How It Works
1. If `config.loadFile` is specified, reads the file content
2. Merges file content into `config.eval` for evaluation
3. Starts the Bun session; a nonempty eval/print selects non-interactive mode
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
- **Tinker is the user-facing command, REPL is the engine** - `buddy tinker` calls `startRepl()` under the hood
- **All framework imports available** - models, database, config, faker, etc. are preloaded
- **History is persisted** - REPL history is saved to disk via `getHistoryPath()`
- **File loading** - loadFile is composed into eval in the current wrapper and may select non-interactive mode; inspect that contract before expecting a prompt
- **Bun runtime** - the REPL runs in Bun's JavaScript runtime, not Node.js


## Native options and bootstrap limits

ReplConfig also exposes bootstrap and showRoutes; startBunRepl delegates directly
to startTinker. TinkerConfig supports eval/print, cwd, custom preload, history
options and a banner setting. tinkerEval/tinkerPrint return the subprocess exit
code, not the JavaScript expression's value. The configured database is real;
REPL mutations are not automatically isolated test data.

The current startRepl implementation combines loadFile/bootstrap/showRoutes
into tinkerConfig.eval. startTinker treats nonempty eval as non-interactive,
so do not promise those options perform setup and then leave a prompt open.
Use a normal startRepl session and explicit imports when that behavior matters,
or inspect the selected CLI wrapper before supplying an eval script.

Preload globals are assembled by the REPL and may be absent when their import
fails; this is a special interactive context, not the normal application's
automatic-global list. History is persisted under getHistoryPath and defaults
to .stacks_tinker_history in the home directory, with owner-only permissions
when created. Avoid evaluating or retaining secrets in history.

Source: `storage/framework/core/repl/src/index.ts` and core/tinker/src/index.ts.
Tests: core/repl/tests/repl.test.ts and the tinker package's existing tests.
