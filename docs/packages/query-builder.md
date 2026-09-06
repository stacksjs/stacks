---
title: Query Builder
description: "@stacksjs/query-builder is the low-level database query interface. It re-exports bun-query-builder; most application code should use models and reach for the query builder when a query does not belong on a model."
---
# Query Builder

`@stacksjs/query-builder` is the low-level database query interface. It re-exports `bun-query-builder`; most application code should use models and reach for the query builder when a query does not belong on a model.

```ts
import { db } from '@stacksjs/database'

const users = await db
  .selectFrom('users')
  .where('active', '=', true)
  .orderBy('name', 'asc')
  .limit(25)
  .get()
```

## Write data

```ts
await db.insertInto('users')
  .values({ name: 'Ada', email: 'ada@example.com' })
  .execute()

await db.update('users')
  .set({ active: false })
  .where('id', '=', 1)
  .execute()

await db.deleteFrom('users')
  .where('id', '=', 1)
  .execute()
```

## Join and aggregate

```ts
const posts = await db
  .selectFrom('posts')
  .join('users', 'posts.user_id', '=', 'users.id')
  .select(['posts.*', 'users.name as author_name'])
  .get()

const count = await db.selectFrom('users').count()
```

Configure dialects, timestamps, pagination, relation limits, transaction retries, SQL features, and soft deletes in `config/query-builder.ts`. SQLite is the default dialect. The database proxy initializes the query builder lazily on first use.

For production SQLite connections without query hooks, the common
`selectFrom().select().where().limit().execute()` shape uses a compact deferred
builder. It avoids allocating the full relationship, aggregate, window, and
pagination surface for a simple read. Any complex method or argument
automatically materializes the complete query builder and replays the chain, so
application code does not need a separate fast-query API. Configured hooks and
global soft-delete scopes retain the complete builder path.

## SQLite write throughput

Stacks defaults to a WAL checkpoint threshold of 100 pages, usually about 400 KB. This bounds the WAL sidecar without checkpointing after every write transaction. Applications with sustained writes can choose a larger threshold through `sqlite.pragmas` in `config/query-builder.ts`:

```ts
// Add this block to the existing query-builder configuration.
sqlite: {
  pragmas: [
    'PRAGMA wal_autocheckpoint = 1000',
    'PRAGMA synchronous = FULL',
  ],
},
```

Application pragmas run after the framework defaults on both the query-builder connection and the model writer. This example keeps foreign-key enforcement and the busy timeout, reduces checkpoint frequency further, and requests full commit synchronization. The 100-page default remains in effect when no checkpoint override is configured. See SQLite's [checkpoint threshold](https://www.sqlite.org/pragma.html#pragma_wal_autocheckpoint) and [synchronization modes](https://www.sqlite.org/pragma.html#pragma_synchronous) for the performance and durability tradeoffs.

Committed rows may remain in the WAL sidecar longer with a larger threshold. Use `buddy db:backup`, which creates a consistent SQLite snapshot, instead of copying only the main database file. Measure the chosen settings on the deployment's storage, and label tuned benchmark results separately from stock defaults.
