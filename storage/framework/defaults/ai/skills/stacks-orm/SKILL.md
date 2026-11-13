---
name: stacks-orm
description: Use when querying or writing Stacks models, using transactions and relationships, preserving inferred model types, or enabling native model traits. Covers @stacksjs/orm, the model runtime, and 110 built-in models.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks ORM

`defineModel` produces an immediately usable query surface over
`bun-query-builder`. Model-driven migrations change the schema; there are no
per-model ORM classes to generate. The framework declares 110 models on disk,
but optional feature gates determine which built-ins load in a running app.

## Definitions and typed rows

Read `stacks-models` for schema, trait, ownership and extension declarations.
Import your app model explicitly when exact inference matters:

```ts
import WorkItem from '../app/Models/WorkItem'
import type { ModelRow, ModelCreateData } from '@stacksjs/orm'

type WorkItemRow = ModelRow<typeof WorkItem>
type NewWorkItem = ModelCreateData<typeof WorkItem>

const item = WorkItem.find(id)
const open = WorkItem.where('done', false).orderBy('id', 'desc').get()
```

`find` can return no row; `findOrFail` throws `ModelNotFoundError`. Do not invent
`UserRequest` or a runtime `UserModel` global. The ORM barrel's model proxies
load lazily; server boot waits for model initialization. A feature-disabled
model is not made usable merely by an ambient declaration.

## Model calls answer in place

A model call returns its value where it is written, on SQLite, MySQL and
Postgres:

```ts
const user = User.where('email', 'like', '%@example.com').orderByDesc('created_at').first()
user?.email                                   // the row is already here

const total = User.count()
if (User.where('email', email).exists()) return response.badRequest('Taken')
for (const post of Post.where('published', true).get()) titles.push(post.title)
```

- **Every read, on every model.** `find`, `findOrFail`, `findMany`, `first`,
  `firstOrFail`, `last`, `all`, `get`, `count`, `exists`, `pluck`, `sum`,
  `avg`, `min`, `max`, `paginate`, `simplePaginate`, `cursorPaginate`, eager
  loading through `with()`, and reads of encrypted attributes.
- **`await` still works.** `await` on a value is that value, so existing code
  and code written by habit run unchanged. The types say the same: a read is
  typed as the row, not as a promise of it.
- **A failure is thrown where the call stands.** `findOrFail` on a missing
  row throws; wrap it in `try`/`catch`. `.catch()` and `.then()` do not exist
  on a row. In a test, `expect(() => User.findOrFail(0)).toThrow()`, not
  `await expect(...).rejects`.
- **How.** SQLite runs a query in place. MySQL and Postgres run on Bun's
  driver, held by a worker thread the caller waits on, so nothing else runs on
  the calling thread while a query is in flight (the cost `bun:sqlite` always
  had). On a Bun whose drivers can wait for a statement themselves
  ([stacksjs/bun](https://github.com/stacksjs/bun)) there is no worker: the
  connection stays on the calling thread. The runtime is looked at when the
  connection opens, the rules are the same either way, and
  `models: { transport: 'worker' }` keeps the worker. `models: { execution: 'async' }` in `config/query-builder.ts` makes MySQL and
  Postgres calls promises again for an app that needs the event loop free
  during queries; every call then has to be awaited.
- **The `db` query builder too.** `db.selectFrom(...).get()` is the rows and
  `transaction(tx => ...)` is done when it returns, on the same rule (see
  `stacks-database`, "Values, not promises").
- **Inside `db.transaction()`, write through `tx`, not through a model.** A
  model call runs on its own connection. One that needs a row the open
  transaction has locked waits for that transaction to finish, and if the
  transaction's own callback is what is waiting for the model call, neither
  can: it fails with `StatementTimeoutError` after `models.timeoutMs` (30
  seconds by default, `0` for no limit). Postgres cancels the abandoned
  statement; MySQL cannot, so there it may still be applied once the lock is
  gone.
- **The one model call that is a promise.** While a transaction with an
  `async` callback is open in the process, a model call that needs a lock it
  holds answers with a promise instead of waiting on the thread the commit
  needs (see `stacks-database`, "Values, not promises"). Any other call is
  still a value.

### Writes: in place, with the work around them

```ts
// Lifecycle events, a search index, a broadcast: the write is still the row.
const order = Order.create({ total: 1200 })
order.update({ total: 1500 })
Order.delete(order.id)

// Declares `useSoftDeletes`: every write is a promise.
const note = await Note.create({ title: 'Draft' })
```

What a model declares around its writes happens like this:

| Declaration | When it runs |
|---|---|
| `traits.observe` | listeners are called in place, in order; the row comes back after them |
| `traits.useSearch` | the index update starts with the write and finishes after it |
| `traits.broadcastOn` | the broadcast starts with the write and finishes after it |
| `set: { ... }`, `hooks: { ... }` written without `async` | in place, as part of the write |

A before-listener (`saving`, `creating`, `updating`, `deleting`) cancels the
write by returning `false` or throwing, and the write throws where it stands.
An after-listener that is `async` runs on after the row is back. A
before-listener that is `async` still has to be waited for, since it may
cancel: that one write becomes a promise, and the ORM warns once per event.
Keep before-listeners synchronous.

A model's writes wait, and are typed as promises, only when its definition
declares something a write cannot do in place:

| Declaration | What the write waits for |
|---|---|
| `traits.useSoftDeletes` / `softDeletable` | the soft-delete transaction |
| `traits.useAudit`, `traits.useActivityLog` | the audit or activity row |
| a `set:` member written `async` | the setter |
| a `hooks:` member written `async` | the hook |

It is decided from the declaration, not from what happens to run: on such a
model `create`, `createMany`, `firstOrCreate`, `updateOrCreate`, `update`,
`save`, `delete`, `forceDelete` and a query's `delete()` are promises every
time, and a failure is a rejection. On any other model they return the value,
and a failure (a guarded column, a validation rule, a listener that refuses)
throws where the call stands. `modelWritesWait(definition)` answers it at
runtime and `ModelWritesWait<typeof Model>` in the types. Reads never wait on
either kind.

Write setters so they answer in place. A password setter uses `makeHashSync`
from `@stacksjs/security`, as the default `User` does: it holds the thread for
the length of the hash (about a quarter of a second for bcrypt at 12 rounds),
and `User.create(...)` is the row. Where that pause is the worse trade, make
the setter `async` with `makeHash` and `await` that model's writes. An
instance write on a model with an async setter goes through `saveAsync()` /
`updateAsync()`.

Work that finishes after the write (the index update, the broadcast, an
`async` after-listener) is logged if it fails and never fails the write. A
server needs nothing more. A script that ends with `process.exit()` waits
first:

```ts
import { modelWorkSettled } from '@stacksjs/orm'

Product.create({ name: 'Widget' })
await modelWorkSettled() // index updates and broadcasts are done; rejects if one failed
process.exit(0)
```

Application seeders and tinker snippets already do this. When in doubt,
`await` the write: it is correct on every model.

## Write behavior

Ordinary create/update paths apply mass-assignment rules, declared validation,
setters, casts, encryption and applicable lifecycle behavior. Partial updates
validate only fields supplied. Quiet writes still validate. `ModelValidationError`
contains a 422 status and per-field errors; use native error mapping at an HTTP
boundary rather than returning raw database errors.

Use instance `update`/`delete` or the supported static `update(id, data)` and
`delete(id)` helpers for an identified row. `firstOrCreate` and `updateOrCreate`
provide explicit lookup/write behavior. Do not confuse a model's static helper
with a fluent builder's `update` terminator.

`forceCreate`, `forceUpdate` and `forceFill` are trusted mass-assignment escape
hatches. They do not mean "disable encryption and validation". Scoped
`withoutValidation` is for deliberate imports/backfills; `withoutEvents` and
quiet helpers suppress events rather than rules. Read
[model capabilities](../stacks-models/references/model-capabilities.md) for
source-backed details.

## Relationships and model instance methods

Declare relationships in the model rather than maintaining foreign-key or
pivot schema separately. The named belongs-to-many form can own pivot columns,
defaults, timestamps and uniqueness. An instance can expose the named relation,
such as `post.tags().sync(ids)`; eager-loaded relations are accessible without
requiring callers to unwrap the raw builder's storage.

Traits expose model/instance methods for tags, categories, comments, likes,
soft deletion, audit/activity feeds, two-factor authentication, provider-neutral
billing and search. Use the exact method exposed by the chosen trait instead
of reaching into underscore-prefixed implementation objects. The runtime checks
`commentable`, not a guessed plural trait name.

Soft-deleted model queries are trait-aware; process-wide raw query-builder
scoping is a separate setting. Restore/force-delete operations and relation
cascade behavior need their own tests. CMS category records and commerce
Category records are distinct domains, even when a relation name looks familiar.

## Transactions

```ts
import { transaction } from '@stacksjs/orm'

await transaction(async (tx) => {
  const created = await tx.insertInto('work_items')
    .values({ title: 'Verify the change', user_id: ownerId })
    .returningAll()
    .executeTakeFirst()
  if (!created)
    throw new Error('Work item was not created')
  return created
})
```

The callback handle owns the transaction's connection. All statements that
must commit or roll back together, including validation reads and readback,
use `tx`. `Model.create`, model queries, instance updates and relation calls
inside this callback are not automatically rebound to it. SQLite, PostgreSQL,
MySQL and Turso have relevant executor/locking differences; do not assume a
model call can observe an uncommitted raw write.

`savepoint` supplies a nested rollback point and `transactional` wraps a
function. Options include retries, isolation, read-only mode, `onRollback` and
`afterRollback`. Read `transaction.ts` and the active driver's capabilities;
not every dialect implements every option identically.

Native transaction scope can defer supported queue/lifecycle side effects
until commit. It does not rebind queries. A post-commit effect failure is
separate from rolling back data that has already committed.

## Native pagination and search

ORM terminals return the canonical full, simple or cursor paginator rather
than an invented `{ paging }` envelope. HTTP context can derive page/limit and
URLs; jobs and CLI callers should supply their values explicitly. See
`stacks-pagination` and `orm/tests/paginator-request.test.ts`.

Model `useSearch` provides a search builder and document projection. Search
hits pagination differs from database pagination. Related dot paths need the
appropriate relation data and hidden attributes remain excluded. Do not pass
an ORM paginator to a search driver and expect identical wire shapes.

## Runtime and schema boundaries

- Import `db` and request-time SQL helpers from `@stacksjs/database/runtime` in
  handlers where tooling is not needed; the root package includes migrations.
- Import `defineModel` and schema helpers explicitly. Model globals exist after
  server boot, while arbitrary ambient helper declarations are not runtime proof.
- `app/Models` replaces defaults by identity. `extendModel` is the additive path.
- Generated CRUD ownership/policy enforcement is a route contract, not a
  promise that every raw query elsewhere is automatically tenant-scoped.
- Casts/encryption/model serialization operate on model paths; raw database
  results bypass the model projection.
- No chain should interpolate unchecked identifiers or operators from a request.
  Use allowlists and the query-builder validation helpers.

## Source and retained evidence

Runtime: `core/orm/src/{define-model,extend-model,model-types,transaction,
model-registry,ownership,auto-crud}.ts`, `traits/`, and `utils/`.
Evidence includes `model-validation`, `mass-assignment`, `force-create-guarded`,
`casting`, `belongs-to-many`, `observed-writes`, `model-policy-wiring`,
`paginator-request`, and the inference type tests. Read their actual contracts
when a workflow depends on a dialect, trait, or return shape.

## Scoped locked operations and stored link credentials

`withLockedRow(table, scope, async (row, tx) => ..., { tx? })` locks and reads
a scoped row on one reserved connection. It returns null for a missing row.
Use the callback handle for every related read/write; `tx` reuses an enclosing
transaction. A scope must identify one row; empty or non-unique scopes are refused. This is the query-builder seam: model
casts, fillable filtering and lifecycle hooks remain the caller's responsibility.

`rowToken({ table, scope, column, action, tx?, timestampColumn? })` manages a
stored share/feed credential. Read returns the live token; enable preserves
it; rotate replaces it; disable clears it. Mutations serialize under the row
lock and join an enclosing transaction when supplied. Missing owners throw
`RowTokenNotFoundError` (404). The default timestamp column is updated_at;
pass false for a table without timestamps. Identifiers and scope must be
application-selected, and the caller must authorize that owner. This is for
stored public-link secrets, not hashed authentication tokens with expiry.
