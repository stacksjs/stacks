---
name: stacks-auto-imports
description: Use when working with the Stacks auto-import system — understanding how browser and server auto-imports work, configuring auto-imported functions/models/composables, the auto-import manifests, type generation, or how globals are injected. Covers the auto-import pipeline at storage/framework/auto-imports/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Auto-Import System

Automatically makes functions, models, composables, and utilities available globally without explicit imports.

## Key Paths
- Auto-import functions: `storage/framework/auto-imports/functions.ts`
- Auto-import models: `storage/framework/auto-imports/models.ts`
- Auto-import index: `storage/framework/auto-imports/index.ts`
- Auto-import globals: `storage/framework/auto-imports/globals.ts`
- Global type declarations: `storage/framework/auto-imports/globals.d.ts`
- Browser manifest: `storage/framework/browser-auto-imports.json`
- Server manifest: `storage/framework/server-auto-imports.json`
- Browser type declarations: `storage/framework/types/browser-auto-imports.d.ts` (~80KB)
- Server type declarations: `storage/framework/types/server-auto-imports.d.ts`
- General auto-import types: `storage/framework/types/auto-imports.d.ts`

## How Auto-Imports Work

### Browser Context (STX Templates)
1. `storage/framework/browser-auto-imports.json` defines available imports (200+ entries)
2. Types are declared in `storage/framework/types/browser-auto-imports.d.ts`
3. STX plugin (`bun-plugin-stx`) resolves imports at build time
4. Available in STX `<script>` tags without explicit `import` statements

### Server Context (Routes, Actions, Jobs)
1. `storage/framework/server-auto-imports.json` defines server-side imports (100+ entries)
2. Types are declared in `storage/framework/types/server-auto-imports.d.ts`
3. All 60+ ORM models are auto-imported as globals
4. Available in any server-side TypeScript file

### Runtime Injection
`storage/framework/auto-imports/globals.ts` injects functions into `globalThis`:
```typescript
// Makes these available globally without imports:
globalThis.increment = increment
globalThis.count = count
globalThis.isDark = isDark
globalThis.toggleDark = toggleDark
// ... geo functions, GPX functions, etc.
```

## What Gets Auto-Imported

### Browser Auto-Imports (200+)
- **Composables**: useStorage, useLocalStorage, useFetch, useToggle, useCounter, useDark, useNow, etc.
- **Utilities**: debounce, throttle, retry, sleep, wait, delay, lazy, clamp, rand
- **Authentication**: useAuth, authGuard, auth
- **Formatting**: formatCurrency, formatDate, formatNumber, formatDuration
- **Browser Query Builder**: browserQuery, BrowserQueryBuilder, browserAuth, createBrowserModel
- **Payment**: confirmCardPayment, confirmPayment, createPaymentMethod, loadCardElement, loadPaymentElement
- **Stripe**: stripe instance
- **Custom Functions**: From `resources/functions/` (counter, dark mode, GPX, geo utilities)

### Server Auto-Imports (100+)
- **All ORM Models**: User, Post, Author, Product, Order, Payment, Customer, etc. (60+ models)
- **Request Models**: UserRequest, PostRequest, OrderRequest, etc.
- **Actions**: Action types and helpers
- **Schema**: validation schema builder
- **Router**: route, response helpers
- **String Utilities**: slug, camelCase, pascalCase, snakeCase, kebabCase, titleCase
- **Core**: path, storage, log, handleError, Auth, register

## Auto-Import Type Declarations

### auto-imports.d.ts (general)
```typescript
declare global {
  const Action: typeof import('@stacksjs/actions').Action
  const response: typeof import('@stacksjs/router').response
  const route: typeof import('@stacksjs/router').route
  const schema: typeof import('@stacksjs/validation').schema
  const slug: typeof import('@stacksjs/strings').slug
  // ... all auto-imported identifiers
}
```

### Adding Custom Auto-Imports

1. Create function in `resources/functions/`:
```typescript
// resources/functions/myUtils.ts
export function myHelper() { return 'hello' }
```

2. Export from `storage/framework/auto-imports/functions.ts`:
```typescript
export { myHelper } from '../../resources/functions/myUtils'
```

3. Declare types in `storage/framework/auto-imports/globals.d.ts`:
```typescript
declare function myHelper(): string
```

4. Inject at runtime in `storage/framework/auto-imports/globals.ts`:
```typescript
globalThis.myHelper = myHelper
```

## Generation Commands

```bash
buddy generate                  # regenerate all auto-imports
buddy generate --types          # regenerate type declarations
buddy generate --ide-helpers    # regenerate IDE helpers
buddy generate:component-meta   # regenerate component metadata
```

The `build:reset` script also regenerates auto-imports.

## Server Auto-Import Initialization

```typescript
import { initiateImports, generateAutoImportFiles, injectGlobalAutoImports } from '@stacksjs/server'

initiateImports()              // initialize auto-import plugin
generateAutoImportFiles()      // generate runtime auto-import files
injectGlobalAutoImports()      // inject models/functions globally
```

## Gotchas
- Browser auto-imports are resolved at BUILD TIME by bun-plugin-stx — not runtime
- Server auto-imports are injected into globalThis at RUNTIME
- The browser-auto-imports.d.ts file is ~80KB — it's auto-generated, don't edit manually
- Custom functions must be exported from both the function file AND the auto-imports barrel
- Type declarations must match the runtime globals for IDE support
- All 60+ ORM models are auto-imported on the server — available as `User.find(1)` etc.
- Request models (e.g., `UserRequest`) are also auto-imported for validated request access
- Auto-imports are regenerated during `buddy generate` and `build:reset`
- The discovered-packages.json file at `storage/framework/discovered-packages.json` is part of this system
