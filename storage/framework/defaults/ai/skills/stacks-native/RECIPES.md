# Native feature recipes

Read the named subsystem skills for their complete contracts. Examples use
explicit imports and supplied facts, not ambient declarations as runtime proof.

## A model becomes schema and protected CRUD

```ts
// app/Models/WorkItem.ts
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'WorkItem',
  table: 'work_items',
  belongsTo: ['User'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useSoftDeletes: true,
    useApi: {
      uri: 'work-items',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
      middleware: ['auth'],
    },
  },
  attributes: {
    title: {
      fillable: true,
      required: true,
      validation: { rule: schema.string().min(1).max(120) },
    },
    done: {
      fillable: true,
      default: false,
      validation: { rule: schema.boolean() },
    },
  },
})
```

The relationship supplies the `user_id` foreign-key column. Generated CRUD
recognizes user ownership and derives it from the authenticated user. A client
cannot choose another owner by changing its request body. This is a user-owned
resource, not a public catalog. Add a policy when per-row abilities need more
rules than ownership alone.

```sh
./buddy generate:migrations
# Review generated SQL and storage/framework/database/model-snapshot.<dialect>.json.
./buddy generate:migrations
# Confirm the second generation has no remaining diff.
./buddy migrate
./buddy generate
```

Generation refreshes registries and type declarations; it does not compile a
new ORM class for this model. Import the app model explicitly when exact
inference matters, or use its server global after boot has injected it.
Test generated create/read/update/delete with real authenticated requests and
another user's rows. Do not substitute a source-grep check for row isolation.

## Extend instead of copying a built-in model

```ts
// app/Models/Order.ts
import { extendModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'
import Order from '../../storage/framework/defaults/app/Models/commerce/Order'

export default extendModel(Order, {
  attributes: {
    collectionNote: {
      fillable: true,
      validation: { rule: schema.string().max(200) },
    },
  },
})
```

Inherited behavior follows upstream. Attribute entries merge by key; replacing
one entry replaces that entry's settings, not just one field inside it. Review
the resulting definition and generate the migration. Imported relations and
the full model override semantics are documented in `stacks-models`.

## Choose a custom action for behavior, not generic CRUD

Use an Action for a domain transition, aggregation, provider operation, or a
different authorization/response contract. Declare `validations` and let
`handle(request)` infer the body rather than annotating it with a broad request
type. `model` gives model-aware validation context; explicit action validations
run automatically before `authorize`, `before`, and `handle`.

Directly register the imported action through `createTypedRouter` when a typed
consumer needs inferred input/output. String action paths remain lazy runtime
references and do not provide the same response inference.

## Atomic work and deferred side effects

Use `transaction(async tx => ...)` and write through `tx` for every statement
that belongs to the transaction. A `Model.create()` inside that callback uses
the model executor; it is not automatically rebound to the callback handle.

Queue dispatch is transaction-aware and can defer until commit. Read
`stacks-queue` for `.afterCommit()`, `.withoutCommit()`, durable handler
descriptors, idempotency, and JSON payload restrictions. Ordered event dispatch
is different from awaiting listeners; use the result-bearing dispatch API
when the calling operation needs listener outcomes.
