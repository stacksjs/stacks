---
name: stacks-plugins
description: Use when working with the Stacks plugin system — Bun plugins, Vite plugins, preloader, or extending the framework's build/serve capabilities. Covers @stacksjs/plugins.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Plugins

## Key Paths
- Core package: `storage/framework/core/plugins/src/`
- Source: `storage/framework/core/plugins/src/index.ts`
- Preloader: `storage/framework/defaults/resources/plugins/preloader.ts`
- Package: `@stacksjs/plugins`

## API

```typescript
import { plugin } from '@stacksjs/plugins'
import type { BunPlugin, VitePlugin } from '@stacksjs/plugins'
```

The package exports:
- `plugin` — Bun's native plugin factory for creating Bun plugins
- `BunPlugin` — Type definition for Bun plugins
- `VitePlugin` — Type definition for Vite plugins

## Creating a Bun Plugin

```typescript
import { plugin } from '@stacksjs/plugins'
import type { BunPlugin } from '@stacksjs/plugins'

const myPlugin: BunPlugin = {
  name: 'my-plugin',
  setup(build) {
    build.onLoad({ filter: /\.custom$/ }, async (args) => {
      const content = await Bun.file(args.path).text()
      return { contents: transformContent(content), loader: 'ts' }
    })
  },
}

plugin(myPlugin)
```

## Preloader

The framework preloader at `storage/framework/defaults/resources/plugins/preloader.ts` runs before the application starts:

- Configured in `bunfig.toml`: `preload = ["./storage/framework/defaults/resources/plugins/preloader.ts"]`
- Loads `bun-plugin-stx` for STX template processing
- Initializes auto-imports and framework globals

## Gotchas
- **Thin wrapper** — re-exports Bun's `plugin` factory and types for both Bun and Vite
- **Preloader is critical** — the STX plugin (`bun-plugin-stx`) must be preloaded for template processing to work
- **Two plugin systems** — Bun plugins (runtime) and Vite plugins (build) are different APIs
- **Plugins must be Bun-compatible** — Node.js plugins won't work without adaptation
- **Plugin preloader runs before app** — any setup in preloader.ts happens before any application code
