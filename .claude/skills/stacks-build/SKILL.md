---
name: stacks-build
description: Use when working with the Stacks build system — building packages, configuring build options, debugging build issues, or understanding the build pipeline. Covers the @stacksjs/build package and build.ts files across the monorepo.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Build System

The `@stacksjs/build` package provides build tools and configurations for the Stacks framework monorepo.

## Key Paths
- Core package: `storage/framework/core/build/src/`
- Framework build: `storage/framework/build.ts`
- Core build: `storage/framework/core/build.ts`
- Individual packages: `storage/framework/core/{package}/build.ts`
- Package: `@stacksjs/build`

## Architecture
- Uses Bun's native bundler (`Bun.build()`)
- Each package has its own `build.ts` that imports `intro`/`outro` from `@stacksjs/build`
- TypeScript declarations generated via `bun-plugin-dtsx`
- Output format: ESM with minification
- Target: Bun runtime

## Standard Build Pattern
Every core package build.ts follows this pattern:
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

## Build Commands
- `bun run build` - Build the entire framework
- `cd storage/framework/core/{package} && bun build.ts` - Build a single package
- `bun run build:reset` - Full clean rebuild (rm deps, reinstall, generate, lint, build)

## Gotchas
- `better-dx` provides `bun-plugin-dtsx` and `typescript` as peer dependencies
- Build output goes to `dist/` in each package
- The `intro`/`outro` helpers provide timing and logging
- Always run `bunx --bun pickier . --fix` before building to ensure clean source
- Compiled CLI binaries: compile:linux-x64, compile:linux-arm64, compile:windows-x64, compile:darwin-x64, compile:darwin-arm64
