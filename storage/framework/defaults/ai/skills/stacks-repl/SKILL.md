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
buddy tinker                              # interactive prompt, app booted
buddy tinker --print 'await User.count()' # evaluate, print the value, exit
buddy tinker --eval 'await seed()'        # evaluate, exit, print nothing
buddy tinker --project ../other-app       # run in another project directory
buddy tinker --bare                       # plain Bun session, app not booted
buddy tinker --serve                      # frame protocol on stdio, for tools
buddy tinker --preload ./setup.ts,pkg     # import modules as globals first
buddy tinker --verbose                    # also show queries and log lines
```

There is no `--load` flag and no `buddy repl` command.

## How a session works

`createTinkerSession({ cwd, boot })` in `@stacksjs/tinker` runs in the current
process. It awaits `overridesReady` from `@stacksjs/config`, then calls
`injectGlobalAutoImports()` from `@stacksjs/server`, which is the same boot the
server, the scheduler and the desktop agent use. So the globals are exactly the
app's: its models, jobs and the framework helpers. Nothing extra is preloaded,
`faker` included; import what the app does not make global.

`session.evaluate(code)` compiles TypeScript with Bun's REPL transform and
evaluates it at global scope:

- several statements work, and the last expression is the result;
- `const`, `let`, functions, classes and imports persist to the next call, and
  a name can be declared again;
- top-level `await` works;
- a relative `import('./x')` resolves against the session's directory;
- nothing is written to the project.

It resolves with `{ ok, value, thrown, frames, durationMs }` and never rejects
for the snippet's own failure. Frames are what happened, in order: `stdout`,
`stderr`, `log`, `query` (sql, params, duration, row count), `dump`, then
`result` or `error`, then `done`. Values in frames are described by
`serialize()`: a bounded, JSON-safe tree that keeps undefined, bigint, Date,
Map, Set, class names, cycles and errors, and records every cut.

`dump(value)` emits a frame. `dd(value)` dumps and stops the current run; it
does not exit the process.

## The frame protocol (`--serve`)

One JSON request per line on stdin: `{ "op": "eval", "id": "a", "code": "..." }`,
`{ "op": "ping" }`, `{ "op": "exit" }`. One frame per line on stdout, each line
starting with the record separator `\x1E`; the first is `ready` with the
session info and protocol version. A line without the marker is stray output,
not a frame. Use `createFrameReader()` to split a stream. `--serve` with
`--eval` or `--print` evaluates once and exits, which suits `ssh -T`,
`docker exec -i` and `kubectl exec -i`.

## Gotchas

- **The database is real.** Mutations are not isolated or rolled back.
- **A returned model is described by its own fields**, hidden ones included.
  Do not paste results from production data without looking.
- **Error positions refer to the compiled snippet**, not the typed source.
- **One evaluation at a time.** Calls queue; they share globals.
- **A session captures `console` and `process.stdout`/`stderr`** for its whole
  life and changes the working directory. Run one per process and call
  `dispose()` when embedding it.
- **History** is written by the interactive prompt to `getHistoryPath()`
  (`~/.stacks_tinker_history`, owner-only). Avoid typing secrets.
- **`startRepl` options `loadFile`, `bootstrap` and `showRoutes`** are folded
  into `eval`, so they run and exit instead of leaving a prompt open.
- `tinkerEval` and `tinkerPrint` resolve with an exit code, not the value. Use
  a session when the value is wanted.

Source: `storage/framework/core/tinker/src/{index,session,serialize,protocol}.ts`
and `core/repl/src/index.ts`. Tests: `core/tinker/tests/session.test.ts`.
