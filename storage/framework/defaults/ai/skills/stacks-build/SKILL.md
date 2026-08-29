---
name: stacks-build
description: Use when working with the Stacks build system - building component libraries, CLI binaries, server Docker images, documentation, or the framework core. Covers @stacksjs/build, buddy build commands, build actions, and the server build pipeline.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Build System

## Key Paths
- Core package: `storage/framework/core/build/`
- Build actions: `storage/framework/core/actions/src/build/`
- Main build action: `storage/framework/core/actions/src/build.ts`
- Buddy commands: `storage/framework/core/buddy/src/commands/build.ts`
- Server build: `storage/framework/server/build.ts`
- Server Dockerfile: `storage/framework/server/Dockerfile`
- Types: `storage/framework/core/types/src/cli.ts`

## Source Files
```
build/src/
├── index.ts              # intro() and outro() — build logging and timing
├── web-types.ts          # Web types generation for IDE support
└── build.ts              # Package build config (Bun.build)

actions/src/build/
├── cli.ts                # Build Buddy CLI binary
├── server.ts             # Build server Docker image
├── core.ts               # Build all framework core packages
├── stacks.ts             # Orchestrate CLI + core builds
├── component-libs.ts     # Build the `components` library packages
├── libs.ts               # Build every configured library package
├── docs.ts               # Build documentation
├── desktop.ts            # Build desktop app
└── views.ts              # Build frontend views
```

## Build Types

```typescript
type BuildOption =
  | 'components' | 'webComponents' | 'elements'
  | 'functions' | 'libs' | 'docs' | 'views' | 'stacks' | 'all' | 'buddy' | 'server'

type BuildOptions = { [key in BuildOption]: boolean } & CliOptions

interface CliOptions {
  verbose?: boolean
  silent?: boolean
  quiet?: boolean
  cwd?: string
  background?: boolean
  timeoutMs?: number
  project?: string
}
```

## CLI Commands

```bash
buddy build                    # Interactive build
buddy build components         # All component libraries
buddy build:components         # Alias
buddy build:web-components     # Web Components library only
buddy build:functions          # The `functions` library packages
buddy build:libs               # Every configured library package
buddy build:cli                # Buddy CLI binary
buddy build:server             # Server Docker image
buddy build:core               # All framework core packages
buddy build:stacks             # CLI + core (full framework)
buddy build:docs               # Documentation site
buddy build:desktop            # Desktop application
buddy build:views              # Frontend views

# Flags
buddy build -c    # --components
buddy build -w    # --web-components
buddy build -f    # --functions
buddy build -l    # --libs
buddy build -d    # --docs
buddy build -b    # --buddy
buddy build -s    # --stacks
buddy build --server --verbose --project [name]
```

## Standard Build Pattern

Every core package follows this pattern:

```typescript
import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({ dir: import.meta.dir })
const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  minify: true,
  plugins: [dts({ root: '.', outdir: './dist' })],
})
await outro({ dir: import.meta.dir, startTime, result })
```

## Releasing libraries out of `resources/`

`resources/functions` and `resources/components` are not limited to one npm
package each. `config/library.ts` carries a `packages` array, and each entry
claims a slice of one of those directories by glob and becomes its own package
with its own name, manifest, dist and version:

```ts
// config/library.ts
packages: [
  // A file may be claimed by more than one package.
  { name: '@acme/fx', kind: 'functions', include: ['*.ts'], exclude: ['internal/**'] },
  { name: '@acme/fx-dates', kind: 'functions', include: ['dates/**'] },
  { name: '@acme/ui', kind: 'components', include: ['ui/**'], prefix: 'acme' },
  { name: '@acme/elements', kind: 'web-components', include: ['ui/**'], prefix: 'acme' },
]
```

The older single-package `functions` / `webComponents` keys still work: they
normalize into the same list, so a config written before `packages` existed
keeps building exactly one package. When `packages` is set, they are ignored.

| Kind | Built by | Published entry |
|---|---|---|
| `functions` | sources staged into the package's `src/`, then `transpilePackage` | `dist/index.js`, one module per source |
| `components` | stx `buildComponentLibrary` | `dist/index.js`, tree-shakeable per-component modules |
| `web-components` | the same compile | `dist/bundle.js`, one self-registering script |

```bash
buddy libs                 # what each package resolved to, on disk
buddy libs --json          # the same, machine-readable
buddy build:libs           # build them all (also `buddy build --libs`)
buddy build:functions      # just the `functions` packages
buddy build:components     # just the `components` packages
buddy build:web-components # just the `web-components` packages
buddy libs:publish --dry-run
buddy libs:publish         # after a build; refuses a package with no dist
```

Packages build in `storage/framework/libs/packages/<dir>/`, where `<dir>` is
the unscoped npm name unless the entry sets `dir`. The whole directory is
generated and gitignored.

### Things that will stop a build, on purpose

- **A package that matches no files.** Nearly always a typo'd glob, and the
  alternative is publishing an empty tarball. The release path skips unmatched
  packages instead, so an app that never filled in `resources/` is not blocked.
- **Two packages that resolve to the same directory** (`@acme/ui` and
  `@other/ui` both unscope to `ui`). Give one an explicit `dir`.
- **stx ambient globals in a `functions` package.** `state`, `useDark` and the
  rest are injected into an stx page entry and exported by nothing, so a
  bundled copy compiles and then throws `ReferenceError` on the consumer's
  first call. Either import the names explicitly, or set `runtime: 'stx'` on
  the package to declare that it is only ever consumed from inside an stx app.

### Release flow

`buddy release` runs `generate/lib-entries`, which stages sources and writes
each manifest without compiling — so a broken library config fails before a tag
exists rather than after. Versions follow the project version unless a package
pins its own, which is why the build (not the generate) is what CI runs after
the bump, and `buddy libs:publish` after that.

## Build Utilities (index.ts)

```typescript
async function intro(options: { dir: string, pkgName?: string, styled?: boolean }): Promise<{ startTime: number }>
async function outro(options: { dir: string, startTime: number, result: any, pkgName?: string }): Promise<void>
```

`outro()` handles two result formats:
- **Bun.build**: checks `result.success` and `result.logs`
- **esbuild**: checks `result.errors` array

## Server Build Pipeline (7 stages)

```
1. Stop running stacks-server Docker container
2. Clean previous build artifacts (app, config, dist, docs, storage)
3. Build framework server (compile ./src/index.ts)
4. Build user app files (compile ./app/**/*.{ts,js})
5. Fix import paths (replace storage/framework/server → dist)
6. Clean unwanted exports from dist files
7. Build Docker image (if cloud deployment enabled)
```

## Build Action Enums

```typescript
enum Action {
  BuildViews = 'build/views'
  BuildStacks = 'build/stacks'
  BuildComponentLibs = 'build/component-libs'
  BuildVueComponentLib = 'build-vue-component-lib'
  BuildWebComponentLib = 'build-web-component-lib'
  BuildFunctionLib = 'build-function-lib'
  BuildCli = 'build/cli'
  BuildCore = 'build/core'
  BuildDesktop = 'build/desktop'
  BuildDocs = 'build/docs'
  BuildServer = 'build/server'
}
```

## Build Tool Stack

| Tool | Usage |
|------|-------|
| **Bun** | Primary bundler (`target: 'bun'`, `format: 'esm'`) |
| **Vite** | Component library builds |
| **bun-plugin-dtsx** | TypeScript declaration generation |
| **Docker** | Server containerization |
| **@babel/traverse** | AST traversal for export cleanup |

## Gotchas
- **Two result formats** — `outro()` must handle both Bun.build and esbuild formats
- **Server build mutates import paths** — stage 5 rewrites references in compiled output
- **Core build is sequential** — packages built one at a time, failures collected and reported
- **Docker build requires cloud config** — only builds if cloud deployment is enabled
- **Component libraries compile through stx**, not Vite. `buildComponentLibrary`
  emits its own index and each generated component registers its custom element
  on import, which is why a `web-components` package needs no entry file of its
  own — it publishes `bundle.js` instead of `index.js`.
- **A library barrel is generated with `.ts` specifiers on purpose.**
  `transpilePackage` rewrites relative `.ts` to `.js` on the way into `dist`. An
  extensionless specifier survives as-is and only resolves under Bun, so the
  package installs cleanly and fails on first import from Node or Vite.
- **`build:stacks` builds CLI first** — Buddy binary compiled before core packages
- **Server build cleans aggressively** — deletes app, config, dist, docs, storage before rebuild
- **The build package has @babel deps** — uses Babel for AST traversal during export cleanup
