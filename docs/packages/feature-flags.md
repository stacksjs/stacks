# Feature Flags

Stacks provides typed, scoped feature flags through `@stacksjs/feature-flags`. The API is inspired by Laravel Pennant and supports boolean flags, multivariate values, deterministic percentage rollouts, runtime overrides, and persistent database storage.

## Quick Start

Define flags during application startup, before they are evaluated:

```typescript
import { Feature, percentage, variants } from '@stacksjs/feature-flags'

Feature.define('new-checkout', percentage(10))
Feature.define('search-layout', variants({
  control: 50,
  compact: 30,
  visual: 20,
}))
Feature.define('team-reports', team => team.plan === 'pro')
```

Evaluate a flag for a scope:

```typescript
if (await Feature.for(user).active('new-checkout')) {
  // Render the new checkout.
}

const layout = await Feature.value('search-layout', user)
```

`Feature` is available as a server auto-import in Stacks applications. The examples use an explicit import so dependencies remain clear and the same code works when the package is used independently.

The first resolved value is stored for the flag and scope. Later reads return that stored value until it is explicitly changed, forgotten, or purged. This makes percentage rollouts and variants sticky for each user, team, or other scope.

Feature evaluation is a server-side concern. When a browser view needs a flag, evaluate it in a route, action, or server script and pass only the resulting value to the client. Do not expose sensitive targeting rules or administrative override APIs in browser code.

## Installation

Feature flags are included with Stacks. For a standalone package, install it with Bun:

```bash
bun add @stacksjs/feature-flags
```

## Configuration

Configure the global `Feature` facade in `config/feature-flags.ts`:

```typescript
import type { FeatureFlagsConfig } from '@stacksjs/types'
import { defineFeatureFlags } from '@stacksjs/config'

export default defineFeatureFlags({
  default: 'memory',
  missing: 'false',
  drivers: {
    memory: {
      cloneValues: true,
    },
    database: {
      table: 'feature_flags',
      autoCreate: false,
    },
  },
}) satisfies FeatureFlagsConfig
```

### Configuration Options

| Option | Values | Default | Purpose |
| --- | --- | --- | --- |
| `default` | `'memory'` or `'database'` | `'memory'` | Selects storage for the global facade. |
| `missing` | `'false'` or `'throw'` | `'false'` | Controls reads of flags with no definition or stored value. |
| `drivers.memory.cloneValues` | `boolean` | `true` | Prevents callers from mutating values held by the memory driver. |
| `drivers.database.table` | SQL identifier | `'feature_flags'` | Selects the table used for resolved values. |
| `drivers.database.autoCreate` | `boolean` | `false` | Allows lazy runtime table creation when explicitly enabled. |

The database driver uses the SQL connection selected by `config/database.ts`. SQLite, MySQL, SingleStore, and PostgreSQL connections are supported.

## Defining Flags

### Boolean Flags

```typescript
Feature.define('new-navigation', true)
Feature.define('legacy-importer', false)
```

### Multiple Definitions

```typescript
Feature.define({
  'new-navigation': true,
  'legacy-importer': false,
  'results-per-page': 50,
})
```

### Resolvers

A resolver receives the original scope and normalized evaluation context:

```typescript
Feature.define('priority-support', async (account, context) => {
  console.log(context.name)
  console.log(context.scopeKey)

  return account.plan === 'enterprise'
})
```

Resolvers may return booleans, strings, numbers, `null`, arrays, or JSON-safe objects. Functions, symbols, `undefined`, circular objects, and non-finite numbers are rejected.

### Checking Definitions

```typescript
Feature.defined('new-navigation')
Feature.definedNames()
Feature.clearDefinitions()
```

Clearing definitions does not delete stored values. Use `purge()` or `flush()` when stored evaluations must also be removed.

## Scopes

Calling `Feature.value('flag')` without a scope uses the global scope. Use `Feature.for(scope)` or pass a scope directly to isolate values per user, team, account, or request domain.

```typescript
const flags = Feature.for(user)

await flags.active('new-checkout')
await flags.value('search-layout')
await flags.values(['new-checkout', 'search-layout'])
```

Stacks ORM model instances use their model name and ID automatically. Plain objects with an `id` should provide `featureFlagType` when IDs can overlap between domain types:

```typescript
const accountScope = {
  id: account.id,
  featureFlagType: 'Account',
}

await Feature.for(accountScope).active('team-reports')
```

For complete control, expose `featureFlagScope` and an optional `featureFlagType`:

```typescript
const scope = {
  featureFlagType: 'Workspace',
  featureFlagScope: workspace.slug,
}

await Feature.for(scope).value('editor-layout')
```

Primitive scopes are type-aware, so the string `'42'` and the number `42` do not share values. Plain object scopes are canonicalized so their property order does not affect identity. Oversized scope keys are hashed before SQL storage.

## Reading Flags

```typescript
await Feature.value('search-layout', user)
await Feature.active('new-checkout', user)
await Feature.inactive('new-checkout', user)

await Feature.values(['new-checkout', 'search-layout'], user)
await Feature.all(user)
```

`active()` converts the resolved value to a boolean. Use `value()` for variants and other non-boolean values.

### Conditional Callbacks

```typescript
const response = await Feature.for(user).when(
  'new-checkout',
  value => renderNewCheckout(value),
  value => renderLegacyCheckout(value),
)

await Feature.for(user).unless(
  'account-suspended',
  () => continueRequest(),
  () => rejectRequest(),
)
```

## Overrides and Stored Values

Activate, deactivate, or assign a variant for one scope:

```typescript
await Feature.for(user).activate('new-checkout')
await Feature.for(user).deactivate('new-checkout')
await Feature.for(user).activate('search-layout', 'compact')
```

Forget one stored evaluation so its definition runs again:

```typescript
await Feature.for(user).forget('new-checkout')
```

Remove selected flags for every scope:

```typescript
await Feature.purge('new-checkout')
await Feature.purge(['new-checkout', 'search-layout'])
```

Remove every stored feature value:

```typescript
await Feature.flush()
```

Changing a resolver, percentage, or variant distribution does not replace values that have already been stored. Purge the affected flag when all scopes must be evaluated against the new definition.

## Percentage Rollouts

`percentage()` deterministically activates a percentage of scopes:

```typescript
import { Feature, percentage } from '@stacksjs/feature-flags'

Feature.define('new-checkout', percentage(15))
```

The bucket is based on the feature name and normalized scope key. The same scope receives the same result, independent of process restarts or request order.

## Variants

`variants()` assigns each scope to one weighted variant:

```typescript
import { Feature, variants } from '@stacksjs/feature-flags'

Feature.define('search-layout', variants({
  control: 50,
  compact: 30,
  visual: 20,
}))

const layout = await Feature.value('search-layout', user)
```

Weights are relative and do not need to add up to 100. Every weight must be positive and finite.

## Database Storage and Schema Ownership

The feature flag schema belongs to the framework package. Stacks does not implicitly create a migration inside the application's `database/migrations` directory.

There are three explicit ways to provision the table.

### Runtime Creation

Enable runtime creation only when the deployed database user is allowed to execute DDL:

```typescript
export default defineFeatureFlags({
  default: 'database',
  drivers: {
    database: {
      table: 'feature_flags',
      autoCreate: true,
    },
  },
})
```

### Explicit Provisioning

Provision the package-owned schema from application setup or deployment tooling:

```typescript
import { db } from '@stacksjs/database'
import { ensureFeatureFlagTable } from '@stacksjs/feature-flags'

await ensureFeatureFlagTable(db, {
  dialect: 'sqlite',
  table: 'feature_flags',
})
```

### Publish SQL Into an Application Migration

Applications that manage all DDL through migrations can request dialect-specific SQL and deliberately publish it through their own migration workflow:

```typescript
import { featureFlagMigrationSql } from '@stacksjs/feature-flags'

const statements = featureFlagMigrationSql({
  dialect: 'postgres',
  table: 'feature_flags',
})
```

`featureFlagMigrationSql()` supports `sqlite`, `mysql`, and `postgres`. SingleStore uses the MySQL schema. Table names are validated as SQL identifiers before any SQL is generated.

For production applications, the recommended setup is `autoCreate: false` with schema SQL applied explicitly during deployment. This keeps runtime database credentials free of DDL permissions.

## Missing Flags

The default behavior returns `false` when a flag has no definition or stored value:

```typescript
await Feature.active('not-defined') // false
```

Use strict mode to catch missing definitions:

```typescript
export default defineFeatureFlags({
  default: 'memory',
  missing: 'throw',
})
```

Strict mode throws `FeatureNotDefinedError`.

## Evaluation Events

Register a listener for observability or analytics:

```typescript
const stopListening = Feature.onEvaluated((evaluation) => {
  console.log(evaluation.name)
  console.log(evaluation.scopeKey)
  console.log(evaluation.value)
  console.log(evaluation.source)
})

stopListening()
```

The source is `stored`, `resolver`, or `missing`. Listener failures are isolated from feature evaluation.

## Testing

Use an isolated in-memory manager in tests so global definitions and stored values cannot leak between test cases:

```typescript
import { describe, expect, test } from 'bun:test'
import { createFeatureFlags } from '@stacksjs/feature-flags'

describe('checkout flags', () => {
  test('enables the new checkout', async () => {
    const flags = createFeatureFlags()
    flags.define('new-checkout', true)

    expect(await flags.for({ id: 1, featureFlagType: 'User' }).active('new-checkout')).toBe(true)
  })
})
```

You can inject a custom driver or scope resolver when testing integrations:

```typescript
const flags = createFeatureFlags({
  driver: fakeDriver,
  missing: 'throw',
  scopeResolver: scope => `test:${scope.id}`,
})
```

## Custom Drivers

A custom driver implements the `FeatureDriver` contract:

```typescript
import { createFeatureFlags, type FeatureDriver } from '@stacksjs/feature-flags'

const driver: FeatureDriver = {
  async get(name, scopeKey) {},
  async set(name, scopeKey, value) {},
  async delete(name, scopeKey) {},
  async deleteForAllScopes(names) {},
  async clear() {},
  async stored(scopeKey) {
    return {}
  },
}

const flags = createFeatureFlags({ driver })
```

Drivers must preserve JSON-safe values and isolate values by both feature name and scope key.

## API Summary

| API | Purpose |
| --- | --- |
| `Feature.define(name, definition)` | Registers a literal or resolver. |
| `Feature.define(definitions)` | Registers multiple definitions. |
| `Feature.for(scope)` | Creates a facade bound to one scope. |
| `Feature.value(name, scope?)` | Returns the stored or resolved value. |
| `Feature.values(names, scope?)` | Returns selected values. |
| `Feature.all(scope?)` | Returns all stored and defined values for a scope. |
| `Feature.active(name, scope?)` | Tests the truthiness of a value. |
| `Feature.inactive(name, scope?)` | Tests whether a value is inactive. |
| `Feature.activate(name, value?, scope?)` | Stores an explicit value. |
| `Feature.deactivate(name, scope?)` | Stores `false`. |
| `Feature.forget(name, scope?)` | Removes one scope's stored value. |
| `Feature.purge(names?)` | Removes selected flags across all scopes. |
| `Feature.flush()` | Removes all stored feature values. |
| `Feature.when()` | Runs a callback based on an active value. |
| `Feature.unless()` | Runs a callback based on an inactive value. |
| `Feature.onEvaluated(listener)` | Observes evaluations and returns an unsubscribe function. |
| `percentage(percent)` | Creates a deterministic percentage resolver. |
| `variants(weights)` | Creates a deterministic weighted variant resolver. |
| `featureFlagMigrationSql(options)` | Returns package-owned schema SQL. |
| `ensureFeatureFlagTable(db, options)` | Explicitly provisions the feature flag table. |

## Related Documentation

- [Configuration](/packages/config)
- [Database](/packages/database)
- [Testing](/packages/testing)
