# Model capabilities and boundaries

Authority: `core/orm/src/define-model.ts`, `extend-model.ts`, `model-types.ts`,
`auto-crud.ts`, `ownership.ts`, the trait implementations, and the retained ORM
tests. Compatibility `ModelOptions` alone does not describe every modern option.

## Additive models and precise types

`extendModel(base, extension)` preserves the built-in definition and adds the
extension. Attributes merge by attribute name; an override replaces that
attribute's complete entry. Traits and dashboard options merge one level deep.
Supported relation lists merge without repeats. Read `mergeModelDefinition`
when extending named-object relationships, hooks, getters or setters; do not
assume every nested object deep-merges. Added attributes without an explicit
order follow the base attributes.

Derive types from the actual definition: `ModelRow<typeof Model>`,
`ModelCreateData<typeof Model>`, `NewModelData<typeof Model>`,
`UpdateModelData<typeof Model>`, `InferColumnNames<typeof Model>` and
`InferNumericColumns<typeof Model>`. Strict create types distinguish fillable
attributes and belongs-to keys from a loose row shape. Do not invent
`UserRequest` or a runtime `UserModel` global.

## Write pipeline

Declared validation runs on direct `create`, `createMany`, and update paths,
before casts and encryption. A partial update validates only supplied fields;
create checks absent required fields. `ModelValidationError` carries status 422
and per-field errors. Generated CRUD accepts camelCase and snake_case aliases
for declared fillable attributes and belongs-to foreign keys.

Mass assignment and serialization differ: `fillable` admits writes, `guarded`
refuses them, and `hidden` removes values from model serialization. Explicit
trusted writes can use `forceCreate`, `forceUpdate`, or `forceFill`; they do not
turn request bodies into trusted data or disable declared validation. Quiet
operations suppress events, not rules. `withoutValidation` is a deliberate
scoped escape hatch for an import or backfill, not an endpoint convenience.

Getters see attributes. Setters receive an attribute object, not just the new
value, and async setters are awaited on the supported write paths. A setter
must return the transformed attribute value. Tests: `model-validation`,
`create-many-pipeline`, `mass-assignment`, `force-create-guarded`,
`instance-mutator`, and `camel-case-accessors`.

## Casts and encrypted attributes

Model `casts` accepts built-in string, number, boolean, integer, float, json,
array, datetime, and date casts, or a custom object with `get` and `set`.
Date/datetime persistence uses UTC. Read the caster implementation for exact
return shapes; JSON parse failures return null and are reported.

An attribute with `encrypted: true` is encrypted on supported model writes and
decrypted on model reads. Both column spellings are handled. Raw SQL and raw
query-builder reads bypass the model's plaintext projection. Encrypted values
are not suitable for ordinary equality/range searching; do not promise searchable
encryption. Tests: `casting.test.ts` and encrypted utility/write coverage.

## Ownership, roles, and policies

Generated CRUD resolves ownership from the authenticated credential. A
`team_id` or `user_id` column can supply the native scope; explicit ownership
can resolve a scalar or permitted set of keys. Helpers include
`selfOwnership`, `customerOwnership`, `siteOwnership`, `parentOwnership`, and
`teamMembershipOwnership`.

`ownership: false` explicitly declares an unscoped resource; use only when that
is the actual resource contract. The default unscoped-write policy can withhold
store/update/destroy for a model without a scope. Middleware and dashboard roles
control entry, ownership controls rows, and policies control abilities on rows.
None substitutes for the others. Do not take an owner identity from a body or
query field. Tests: `ownership`, `row-scoping-policy`, `model-dashboard-roles`,
`model-policy-wiring`, and resource-specific security contracts.

## Lifecycle, search, retention, and sharding

`observe` emits native lifecycle events. `withoutEvents` and quiet operations
can suppress them within their scoped operation. With observation enabled,
`broadcastOn` plus `broadcastWith` publishes a curated lifecycle projection;
avoid broadcasting the entire private row. `useActivityLog` writes a readable
change feed, while `useAudit` records old/new diffs. Hidden/sensitive fields
remain excluded from the activity projection.

`useSearch` supplies model search helpers and a projected searchable document.
Related dot-path attributes need their relation data; missing relation data
does not magically trigger every required query. Hidden fields stay excluded.
Search-engine pagination has its own hits contract; ORM pagination returns
native paginator objects. Read `stacks-search-engine` and `stacks-pagination`.

`prunable` declares age/query-based pruning. GDPR ownership, personal attributes,
access, erasure and retention are distinct declarations, not a global delete
switch. For Vitess, `sharding` configures derived or explicit VSchema behavior;
it is not an automatic cluster deployment and is ignored on single-node dialects.
Use `buddy generate:vschema` and the current dialect evidence before deploying.

## Transaction and row-count gotchas

Model execution is separate from a `transaction` callback's `tx` handle.
Use `tx` for all statements that must share that transaction. Model calls inside
the callback do not automatically observe its uncommitted writes.

A driver can report matched rows differently from changed rows. Use native
`mutationCount` or `matchedRows` only according to the operation's real contract;
do not interpret an arbitrary `execute()` value as a universal affected-row
object. Use the service's returned row/not-found contract at an HTTP boundary.
