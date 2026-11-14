# Durable SQL replay

This opt-in store retains a bounded, ordered JSON event history in an
application's model-generated SQLite or PostgreSQL tables. It is separate from
`setReplayBuffer`/`recordBroadcast`/`replaySince`, whose synchronous APIs and
process-local semantics remain unchanged. It does not add Redis, cluster live
fan-out, socket acknowledgments or exactly-once network delivery.

## Schema and transaction contract

The fixture application under `tests/fixtures/replay-app` contains complete
native model examples, generated SQLite/PostgreSQL corpora and dialect
snapshots. Copy the declarations into your app, add your ownership fields and
indexes, and run native migration generation/review/application. No default
models are installed and the store never creates or alters tables at runtime.
Neither model has generic CRUD/dashboard access. The event model declares a
cascading channel FK and unique `(channel_id, seq)` and
`(channel_id, operation_key)` indexes. Channel uniqueness includes the scope
columns plus the exact channel name; incarnation is unique.

```ts
import { db } from '@stacksjs/database/runtime'
import { createSqlDurableReplayStore } from '@stacksjs/realtime'

const store = createSqlDurableReplayStore({
  dialect: 'postgres',
  tables: { channels: 'replay_channels', events: 'replay_events' },
  // Resolve these from trusted server context, after current authorization.
  scope: { workspace_id: workspace.id, project_id: project.id },
  transaction: callback => db.transaction(async tx =>
    callback(async (sql, values) => await tx.unsafe(sql, values).execute())),
  maxEvents: 100,
  ttlMs: 300000,
})
```

The transaction adapter **must** use a single transaction-bound connection for
all callback queries, await the callback, commit on success, roll back on failure
and hold row locks until commit. Passing a pool/global query function that
escapes the transaction violates the contract. Use a primary connection. A
SQLite connection must serialize its async transactions; parallel workers can
use separate connections and the database writer lock. The store supplies
native `?` placeholders on SQLite and `$1...` on PostgreSQL.

Each operation inserts the checkpoint if absent and takes a point UPDATE lock
on its scoped channel. Appending the event and advancing the counter happen in
that same transaction. Another writer or replay request cannot pass an
uncommitted sequence, and rollback consumes none. Application row locks should
be acquired before this channel lock when composing larger domain transactions;
keep one lock order across all workers to avoid deadlocks. A nested savepoint
is not a durable commit: do not publish or expose an append cursor until the
enclosing transaction commits. Run `publishDurableReplay` with an adapter whose
transaction commits before returning, outside an uncommitted ambient transaction.

Scope column identifiers/values and table names are captured at construction.
They partition data; they do not authenticate anybody. Column/table identifiers
are validated and values are bound. The core cannot infer ownership from a
workspace label or caller-selected channel. Applications remain responsible for
project/contact/message visibility and authoritative channel selection.

## Append, cursor and replay

```ts
const saved = await store.append({
  channel: 'private-project.42', event: 'message.changed',
  data: { messageId: '123' }, idempotencyKey: 'outbox-event-456',
})
const page = await store.replay({ channel: 'private-project.42', after: saved.cursor, limit: 100 })
```

The JSON payload is snapshotted and canonicalized. A retained operation ID with
identical event/data returns the original sequence; changed data produces
`replay_idempotency_conflict`. Appending does not broadcast implicitly. The
awaited `publishDurableReplay({store,input,notify})` commits first and then calls
your notifier with the message/cursor. It notifies retained retries too: hints
can repeat, so consumers deduplicate by incarnation and sequence. A crash or
notifier failure leaves the committed event available for replay. A successful
callback is not proof of remote receipt.

A cursor is `{ incarnation, seq }`. The persisted random incarnation changes
when a deleted channel is recreated, even if the new sequence starts at 1. An
old/different channel cursor returns `gap: 'incarnation'`, no messages and no
advanced cursor. Ahead-of-head cursors return `cursor_ahead`; expired/evicted
history returns `retention`. A gap is HTTP 409, never an empty successful page.
Re-read an authorized domain snapshot and establish its matching checkpoint
before resuming; the library cannot make an application snapshot atomic for you.
Do not silently advance to `head` when receiving a gap.

A valid page returns only contiguous retained events, a cursor through the last
returned event, the persisted `head`, `prunedThrough` and `hasMore`. Size-limited
pages never advance over an unreturned event. Missing rows outside recorded
retention produce `replay_storage_gap` instead of skipping a sequence. Sequence
numbers stop with an explicit error at JavaScript's maximum safe integer.

## Bounds and lifetime

Defaults are 100 events/channel, five-minute TTL, 64 KiB JSON payloads and a
1 MiB message-page byte budget. Limits allow at most 10,000 retained events,
one-year TTL, 64 KiB payloads, 16 MiB page budget and 100 events per replay
request. JSON nesting (32) and node count (4096) are bounded; nonfinite values,
functions, BigInts, cycles, sparse arrays and non-JSON objects are rejected.
Array lengths are checked against the remaining node budget before any element
traversal or allocation; holes cannot bypass the bound or reach serialization. Response byte
budget counts serialized message records; the small page envelope is additional.

Retention removes a prefix on append/replay/explicit `prune(channel)`. It
persists the removed sequence floor without resetting the checkpoint. The
clock is monotonic per channel relative to its last recorded timestamp. TTL
expiry is inclusive at the deadline. Workers must use the same persisted
retention policy; a different policy fails closed. To change policy, use an
explicit application migration/reset with a new incarnation.

**Idempotency is bounded by retained event lifetime.** Once an event expires or
is count-evicted, its operation receipt is removed too. Reusing that ID can
append a new event with a higher sequence. A domain outbox that needs permanent
deduplication must retain its own durable receipt; do not claim permanent
exactly-once effects from this store. SQL storage is bounded per active channel,
not across arbitrary channel cardinality. Checkpoint metadata is deliberately
retained forever to preserve cursor continuity. Apps must bound channel creation
and schedule pruning for inactive channels; lazy pruning does not reclaim an
inactive channel until touched. Backups/PITR that rewind stored history require
an application-owned incarnation reset before accepting old client cursors.

## Authenticated HTTP boundary

```ts
return createDurableReplayResponse({
  store,
  channel: serverSelectedChannel,
  after: parsedCursor,
  authorize: async channel => currentAccountMayReplay(request, channel),
})
```

Authorization is mandatory, bound to this request, and checked before storage
and again after the transaction, immediately before constructing the response.
Resolve current credentials, expiry, membership and channel grants each time;
never use a cached subscription as authority. It returns 403 when revoked,
503 for unavailable authorization/storage, 422 for malformed inputs and
`Cache-Control: no-store` on every response. It is a finite replay endpoint,
not a live SSE stream; existing stream consumers keep their current event and
heartbeat authorization. Data already returned/in flight cannot be withdrawn.

## Qualification

`durable-replay*.test.ts` tests the public fake/SQL/HTTP seams. It applies only
model-generated schema to real SQLite and owned disposable PostgreSQL, starts
independent worker processes, holds an uncommitted channel transaction, races
append/replay, kills a writer, rolls another back and restarts readers. It also
covers scope partitions, retained retries/conflicts, exact TTL/count gaps,
incarnation reset, bounded pagination/JSON and authorization revoked while a
real SQL replay response is pending. HTTP grant callbacks are fixture-owned
application authorization boundaries; they do not qualify a particular app's
account model or private-message projection. No provider calls are required.
