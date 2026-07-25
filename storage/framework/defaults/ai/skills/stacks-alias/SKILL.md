---
name: stacks-alias
description: Use when working with path aliases in a Stacks project — import resolution, module aliasing, or debugging import paths. Covers @stacksjs/alias which defines 260+ path mappings for the entire framework.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Path Aliases

## Key Paths
- Core package: `storage/framework/core/alias/src/`
- Source: `storage/framework/core/alias/src/index.ts`
- Package: `@stacksjs/alias`

## API

```typescript
import { alias } from '@stacksjs/alias'

const alias: Record<string, string>  // 260+ entries
```

## Alias Categories

### Framework Module Aliases
Maps `@stacksjs/*` and `stacks/*` imports to their source files:

```typescript
'@stacksjs/ai':          'storage/framework/core/ai/src/index.ts'
'@stacksjs/auth':        'storage/framework/core/auth/src/index.ts'
'@stacksjs/database':    'storage/framework/core/database/src/index.ts'
'@stacksjs/router':      'storage/framework/core/router/src/index.ts'
'@stacksjs/cache':       'storage/framework/core/cache/src/index.ts'
'@stacksjs/cli':         'storage/framework/core/buddy/src/index.ts'
'@stacksjs/config':      'storage/framework/core/config/src/index.ts'
// ... all core packages
```

Both `@stacksjs/` and `stacks/` prefixes are supported:

```typescript
'stacks/auth':            'storage/framework/core/auth/src/index.ts'
'stacks/database':        'storage/framework/core/database/src/index.ts'
```

### Config Aliases
Maps `~/config/*` to config files:

```typescript
'~/config/database':      'config/database.ts'
'~/config/dns':           'config/dns.ts'
'~/config/docs':          'config/docs.ts'
'~/config/email':         'config/email.ts'
// ... all 44 config files
```

### Resource Aliases
Maps `~/` paths to project directories:

```typescript
'~/app/*':                'app/*'
'~/components/*':         'resources/components/*'
'~/functions/*':          'resources/functions/*'
'~/views/*':              'resources/views/*'
'~/lang/*':               'locales/*'
'~/*':                    '*'
```

### Framework Aliases
```typescript
'framework/*':            'storage/framework/*'
'@/*':                    '*'
```

## Usage

Aliases are automatically resolved by Bun at runtime and by the build system for production:

```typescript
// These all work because of aliases
import { db } from '@stacksjs/database'
import { route } from '@stacksjs/router'
import { auth } from 'stacks/auth'
import dbConfig from '~/config/database'
```

## Gotchas
- **260+ entries** — covers every core package, config file, and resource directory
- **Dual prefixes** — both `@stacksjs/` and `stacks/` resolve to the same source files
- **Runtime resolution** — Bun resolves these at runtime via `bunfig.toml` preloading
- **Build-time resolution** — the build system resolves aliases to actual paths for production
- **Always use aliases** — never use relative paths between packages in the monorepo
- **Adding new packages** — requires adding alias entries for both `@stacksjs/` and `stacks/` prefixes
