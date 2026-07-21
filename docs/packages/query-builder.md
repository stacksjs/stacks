---
title: Query Builder
description: "is the low-level database query interface. It re-exports ; most application code should use models and reach for the query builder when a query does not be..."
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

Configure dialects, timestamps, pagination, relation limits, transaction retries, SQL features, and soft deletes in `config/qb.ts`. SQLite is the default dialect. The database proxy initializes the query builder lazily on first use.
