# @stacksjs/model-meta

Model metadata derived from a model definition: table names, pivot tables,
relations, and the attribute helpers that read them.

This is a leaf. It reads a `Model` and returns facts about it, and it depends on
nothing that can lead back to the ORM or the database layer.

That independence is the point. `@stacksjs/database` needs to know what table a
model maps to, but it has no business importing the ORM to find out — and when
it did, `orm → database → drivers/helpers → orm` deadlocked bun's module loader.
The import had to be held at a deep path inside `@stacksjs/orm` to step around
the cycle. Extracting these helpers removes the cycle instead.

`@stacksjs/orm` re-exports everything here, so `import { getTableName } from
'@stacksjs/orm'` keeps working.

```ts
import { getPivotTables, getTableName } from '@stacksjs/model-meta'

getTableName(model, modelPath) // 'users'
await getPivotTables(model, modelPath) // [{ table: 'role_user', ... }]
```
