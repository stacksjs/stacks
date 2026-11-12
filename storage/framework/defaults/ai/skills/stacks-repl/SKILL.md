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
buddy tinker --print 'User.count()'       # evaluate, print the value, exit
buddy tinker --eval 'seed()'              # evaluate, exit, print nothing
buddy tinker --project ../other-app       # run in another project directory
buddy tinker --bare                       # plain Bun session, app not booted
buddy tinker --serve                      # frame protocol on stdio, for tools
buddy tinker --preload ./setup.ts,pkg     # import modules as globals first
buddy tinker --verbose                    # also show queries and log lines
```

There is no `--load` flag, and tinker is the only command: nothing is registered under the name repl.

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
- a query needs no `await` at the top level (see "No await at the top level");
  top-level `await` still works;
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

## No await at the top level

Outside a function, a snippet reads as if it ran in order. Both of these bind
the row, and the line after can use it:

```ts
const user = await User.where('email', 'like', '%@example.com').orderByDesc('created_at').first()
const user = User.where('email', 'like', '%@example.com').orderByDesc('created_at').first()

user.email                                  // the email, not undefined
User.first().email                          // mid-expression too
if (User.where('active', true).exists()) dump(User.count())
for (const post of Post.latest().limit(5).get()) dump(post.title)
```

The rule: outside a function, a call that returns a promise is waited for
where it stands, and so is a promise a statement names (the value of a line,
of a declaration, of an assignment). A rejection is thrown there, so
`User.findOrFail(0)` fails the run it was written in.

- **Inside a function nothing changes.** `await` there is yours to write:
  `users.map(async user => await user.posts())`.
- **Promise-handling code keeps its promise:** the receiver of `.then()`,
  `.catch()` or `.finally()`, the arguments of `Promise.all()` and its
  siblings (so they still run together), the operand of `void` (fire and
  forget), and anything already under `await`.
- **Only a real `Promise` is waited for.** A query builder is not, so
  `const query = User.where('active', true)` keeps the builder and
  `query.count()` and `query.first()` both work.
- **A snippet with no promise in it is untouched at runtime:** same order,
  same turn. Only a promise causes a wait.

`createTinkerSession({ settle: false })` turns it off for a session,
`session.evaluate(code, { settle: false })` and the request field
`"settle": false` for one run. A promise is then a promise, as in plain
JavaScript.

The transform is `settleTopLevel(code)`. It reads the snippet with a real
TypeScript parser and only inserts text, so no line moves; code it cannot
parse comes back untouched for the runtime to report. An editor that wants
the same answer from the type checker (`user` typed as the row, not as a
promise) checks `settleTopLevel(code, { wrap: SETTLE_TYPE_WRAP })` with
`SETTLE_TYPE_AMBIENT` in scope and maps positions with `settledOffset` and
`originalOffset`.

## The frame protocol (`--serve`)

One JSON request per line on stdin: `{ "op": "eval", "id": "a", "code": "..." }`,
`{ "op": "ping" }`, `{ "op": "exit" }`. One frame per line on stdout, each line
starting with the record separator `\x1E`; the first is `ready` with the
session info and protocol version. A line without the marker is stray output,
not a frame. Use `createFrameReader()` to split a stream. `--serve` with
`--eval` or `--print` evaluates once and exits, which suits `ssh -T`,
`docker exec -i` and `kubectl exec -i`.

## Magic comments

A comment that starts with a question mark shows a value where it is computed.
The run's result is unchanged, and no line moves.

```ts
const users = User.all() //?                       the value of users
users.filter(u => u.active)/*?.length*/.map(u => u.name) //?
rebuildIndex() //?.                                 ms since the run began
```

- `//?` at the end of a line: the statement that ends there. A declaration
  shows the names it binds; anything else shows the expression.
- A block form written hard against an expression (no space before it) shows
  that expression mid-chain. Text after the question mark is read off the
  value first: `.length`, `.count()`, `[0]`.
- `//?.` shows elapsed milliseconds.

Each one arrives as a `probe` frame carrying its zero-based line.
`instrumentMagicComments(code)` is the transform, exported for a tool that
wants to mark which lines have a probe. It works from tokens, not a syntax
tree: a comment it cannot place with certainty (after an `if` block, a loop, a
`throw`) stays an ordinary comment. `createTinkerSession({ magic: false })`
turns the feature off.

## Previews and the model list

`preview.mail('welcome', { name: 'Ada' })` renders a template from
`resources/emails` and returns a value the result is shown as a page for
(`{ t: 'html', kind: 'mail', html, text }`). `preview.html(markup, title)` does
the same for any markup. Rendering one stx view to a string is not offered
yet: stx does not export it.

`session.models()`, or the request `{ "op": "models" }`, lists every model the
booted app loaded with its table, attribute names and declared relations. It is
what a relation graph and a completion list are built from.

## Gotchas

- **The database is real.** Mutations are not isolated or rolled back.
- **A promise held on purpose needs a function or `void`.** At the top level
  `const job = startJob()` waits for the job. `void startJob()` does not, and
  neither does anything inside a function.
- **A model is described as a model.** A result that is a model instance is a
  `model` node: its name, table, key, the attributes its `toJSON()` exposes, the
  relations it declares and the ones already loaded. Hidden attributes (a
  password hash) are named under `hidden` and their values never leave the
  process, in frames and in `--print` alike.
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

Source: `storage/framework/core/tinker/src/{index,session,settle,magic,serialize,protocol}.ts`
and `core/repl/src/index.ts`. Tests: `core/tinker/tests/{session,settle,magic}.test.ts`.
