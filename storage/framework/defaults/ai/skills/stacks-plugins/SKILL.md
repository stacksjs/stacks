---
name: stacks-plugins
description: Use when working with the Stacks preload chain and Bun plugins — the env plugin, the framework preloader, how auto-imports get injected into globalThis, why a command does or does not see framework globals, the bun-plugin-stx static-serve plugin, or writing a Bun plugin. Covers bunfig.toml preload and storage/framework/defaults/resources/plugins/preloader.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Plugins and the Preload Chain

Stacks has **no `@stacksjs/plugins` package**. "Plugins" here means Bun's native
plugin API plus the two modules `bunfig.toml` preloads before any Stacks code
runs. If you are chasing "why is `User` undefined in this command" or "why did
`.env` not decrypt", this is the skill.

## Key Paths

- Preload declaration: `bunfig.toml` (`preload`, at the root and under `[test]`)
- Env plugin: `storage/framework/core/env/plugin.ts`
- Framework preloader: `storage/framework/defaults/resources/plugins/preloader.ts`
- Static-serve plugin: `bunfig.toml`, `[serve.static] plugins = ["bun-plugin-stx"]`

## The preload chain

`bunfig.toml` preloads two modules, **in this order**:

```toml
preload = [
  "./storage/framework/core/env/plugin.ts",
  "./storage/framework/defaults/resources/plugins/preloader.ts",
]
```

1. **Env plugin** loads `.env` and decrypts dotenvx-style encrypted values, so
   everything downstream reads plaintext from `process.env`.
2. **Preloader** loads env files for the resolved environment, then injects the
   framework's server auto-imports into `globalThis`.

Order is load-bearing: the preloader reads decrypted secrets, so it has to run
second.

Tests preload a different pair - the env plugin and `tests/setup.ts` - so the
suite gets production env semantics without the auto-import graph.

## What the preloader does

### 1. Resolves the environment

Before loading any `.env` file it works out `APP_ENV`, because that decides
*which* file gets decrypted:

- `deploy staging` and `deploy --staging` both resolve to `staging`. Both forms
  are handled; CI uses the flag form.
- `cloud:remove`, `cloud:destroy`, `cloud:cleanup`, `undeploy` force `production`.
- Bare `deploy` defaults to `production`.

### 2. Loads and decrypts env files

Gated on **`isRepl` / `isPostinstall` only** - never on the fast-command list
below. Fast commands (`migrate`, `build`, `seed`, ...) genuinely need decrypted
config; gating them here caused stacksjs/stacks#2048, where an encrypted
`.env.<env>` silently never decrypted even with the key present.

Postinstall skips because `@stacksjs/env` may not be linked yet mid-install.

### 3. Injects auto-imports into `globalThis`

Loads ~24 framework packages plus everything in `app/Jobs/` and
`resources/functions/`, assigning every named export onto `globalThis`. That is
why `await User.find(1)` and `response.json(...)` work in an action with no
import statement. See `stacks-auto-imports` for the full manifest.

A `protectedGlobals` set guards the runtime: `process`, `fetch`, `Promise`,
`Bun`, `console` and friends are never overwritten, whatever a package exports.

## The fast-command skip (the usual gotcha)

Auto-import injection is **skipped** when the first CLI argument matches:

```
dev  build  test  lint  migrate  fresh  seed  generate  make
key:generate  scaffold:crud  version  help  --version  -v  --help  -h
```

Prefix matches count, so `generate:migrations` skips along with `generate`.

Two reasons: cold-start speed, and correctness. Codegen commands must not pull
the router and ORM graph in before `bun-query-builder` can diff schemas - a
broken `@stacksjs/bun-router` install used to make `generate:migrations` exit 1
with no output at all, because the preloader died loading `@stacksjs/router`.

**Consequence:** inside those commands, framework globals do not exist. Import
what you need explicitly.

The REPL skips too (`!process.argv[1]`), as does anything running under
`npm_lifecycle_event === 'postinstall'`.

### Opting back in

The preloader exports `loadAutoImports()` so a server entrypoint can pull the
graph in deliberately:

```ts
const { loadAutoImports } = await import('../../../defaults/resources/plugins/preloader.ts')
await loadAutoImports()
```

`dev/api.ts` does exactly this. Bun consumes `--watch`, so a directly-run server
script sees an empty `argv.slice(2)` and would otherwise be indistinguishable
from a bare invocation.

## Writing a Bun plugin

Use Bun's native API directly - there is no framework wrapper to import:

```ts
import { plugin } from 'bun'

plugin({
  name: 'my-loader',
  setup(build) {
    build.onLoad({ filter: /\.custom$/ }, async (args) => {
      const contents = await Bun.file(args.path).text()
      return { contents: transform(contents), loader: 'ts' }
    })
  },
})
```

Register it by adding the module to `preload` in `bunfig.toml`. A plugin only
affects the process that preloaded it.

## Gotchas

- **No `@stacksjs/plugins` package.** Import `plugin` from `bun`.
- **Preload order matters.** Env decryption has to precede the preloader.
- **Fast commands have no globals.** If a `make:*` or `generate:*` command needs
  a framework symbol, import it - do not rely on auto-imports.
- **`bun-plugin-stx` is a static-serve plugin**, wired through
  `[serve.static] plugins` in `bunfig.toml`. The preloader's own
  `import 'bun-plugin-stx'` line is commented out; stx compilation in the dev
  server runs through the stx package, not that import.
- **Preloader failures are silent per package.** Each import sits in its own
  `try {} catch {}`, so a package that fails to build leaves its globals
  undefined instead of crashing the process. A mysteriously undefined global is
  usually an unbuilt package - check `storage/framework/core/<pkg>/dist`.
- **Adding a global?** Export it from a package already in the preloader's list,
  or from `resources/functions/`, then run `buddy generate --types` so the
  declarations match the runtime.
