---
name: stacks-registry
description: Use when working with the Stacks extension registry — framework extension metadata, package discovery, or the registry system. Covers @stacksjs/registry.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Registry

## Key Paths
- Core package: `storage/framework/core/registry/src/`
- Config: `config/stacks.ts`
- Package: `@stacksjs/registry`

## Source Files
```
registry/src/
└── index.ts              # Registry definition and exports
```

## API

```typescript
import { registry } from '@stacksjs/registry'
import type { Registry } from '@stacksjs/registry'

type Registry = StackExtensionRegistry

const registry: Registry = [
  {
    name: 'stacks',
    url: 'stacksjs.com',
    github: 'stacksjs/stacks',
  },
]

export default registry
```

The registry is a simple array of `StackExtensionRegistry` entries containing framework extension metadata — name, URL, and GitHub repository.

## Usage

```typescript
import { registry } from '@stacksjs/registry'

// Access extension metadata
registry.forEach(ext => {
  console.log(ext.name, ext.url, ext.github)
})
```

## Gotchas
- **Minimal package** — currently just a static array with the core Stacks framework entry
- **Type comes from `@stacksjs/types`** — `StackExtensionRegistry` is defined in the types package
- **Used for framework metadata** — not a package manager or dependency registry
- **Config in `config/stacks.ts`** — the `StackExtensionRegistry` config is defined there
