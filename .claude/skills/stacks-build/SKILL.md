---
name: stacks-build
description: Use when working with the Stacks build system — building component libraries, CLI binaries, server Docker images, documentation, or the framework core. Covers @stacksjs/build, buddy build commands, build actions, and the server build pipeline.
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
├── component-libs.ts     # Build component libraries (Vue + Web)
├── docs.ts               # Build documentation
├── desktop.ts            # Build desktop app
└── views.ts              # Build frontend views
```

## Build Types

```typescript
type BuildOption =
  | 'components' | 'webComponents' | 'elements'
  | 'functions' | 'docs' | 'views' | 'stacks' | 'all' | 'buddy' | 'server'

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
buddy build:functions          # Functions library
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
- **Component libraries use Vite** — unlike the rest which uses Bun.build
- **`build:stacks` builds CLI first** — Buddy binary compiled before core packages
- **Server build cleans aggressively** — deletes app, config, dist, docs, storage before rebuild
- **The build package has @babel deps** — uses Babel for AST traversal during export cleanup
