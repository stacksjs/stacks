# @stacksjs/feature-flags

Typed, scoped feature flags for Stacks applications. The API follows the useful parts of Laravel Pennant while keeping storage and scope handling explicit for TypeScript.

```ts
import { Feature, percentage, variants } from '@stacksjs/feature-flags'

Feature.define('new-checkout', percentage(10))
Feature.define('search-layout', variants({ control: 50, compact: 30, visual: 20 }))
Feature.define('team-reports', team => team.plan === 'pro')

if (await Feature.for(user).active('new-checkout')) {
  // Render the new checkout.
}

const layout = await Feature.value('search-layout', user)
```

Scopes are type-aware. Stacks ORM instances use their model definition and ID automatically. Plain objects with an `id` should provide `featureFlagType` when IDs can overlap across domain types:

```ts
await Feature.for({ id: account.id, featureFlagType: 'Account' }).active('team-reports')
```

Resolved values are sticky per scope. The first evaluation is stored by the configured driver and reused until it is changed or forgotten.

```ts
await Feature.for(user).activate('new-checkout')
await Feature.for(user).deactivate('new-checkout')
await Feature.for(user).forget('new-checkout') // evaluate its definition again
await Feature.purge('new-checkout') // forget it for every scope
```

## Configuration

`config/feature-flags.ts` selects the global facade's driver:

```ts
import { defineFeatureFlags } from '@stacksjs/config'

export default defineFeatureFlags({
  default: 'database',
  missing: 'false',
  drivers: {
    memory: { cloneValues: true },
    database: { table: 'feature_flags', autoCreate: false },
  },
})
```

The schema belongs to this package. It never writes into an application's `database/migrations` directory implicitly. Applications can explicitly provision it, opt into lazy creation, or publish the generated SQL through their own migration workflow:

```ts
import { db } from '@stacksjs/database'
import { ensureFeatureFlagTable, featureFlagMigrationSql } from '@stacksjs/feature-flags'

await ensureFeatureFlagTable(db, { dialect: 'sqlite', table: 'feature_flags' })
const statements = featureFlagMigrationSql({ dialect: 'postgres' })
```

Set `autoCreate: true` only when runtime DDL is appropriate for the application. Production applications will usually publish `featureFlagMigrationSql()` into their migration workflow and leave automatic creation disabled.

Use an isolated manager in tests:

```ts
import { createFeatureFlags } from '@stacksjs/feature-flags'

const flags = createFeatureFlags()
flags.define({ checkout: true, recommendations: false })
```
