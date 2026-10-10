---
name: stacks-events
description: Use when working with the event system in a Stacks application - dispatching events, listening for events, model events, wildcard listeners, the event emitter, or event-driven architecture. Covers @stacksjs/events, app/Events.ts, app/Listener.ts, and app/Listeners/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Events

Use the native event bus for process-local application and model events. Use
`stacks-realtime` for network broadcasting and `stacks-queue` for durable work.

## Dispatch and completion

`@stacksjs/events` exports `dispatch`, `dispatchAsync`,
`dispatchAndCollect`, `listen`, `once`, `off` and `emitter`.

- `dispatch(name, payload)` invokes handlers immediately and returns void.
  Async handlers continue without blocking the caller; errors are logged.
- `await dispatchAsync(name, payload)` awaits matching handlers in sequence.
  Rejections are logged and appear as undefined results, so this does not prove
  that every handler succeeded.
- `await dispatchAndCollect(name, payload)` returns a result for each handler:
  `{ ok: true, value }` or `{ ok: false, error }`. Inspect failures when
  downstream work determines the response.

Payloadless events are supported by the emitter. Exact handlers receive the
payload; wildcard and glob handlers receive `(eventName, payload)`.

`emitter.on(name, handler, { priority })` sorts higher priorities first
within each handler bucket. Equal priority preserves registration order.
Exact handlers run before glob buckets, then `*` handlers. Snapshotting keeps
subscription changes during a dispatch from corrupting iteration.

## Typed application events

`StacksEvents` combines built-in auth events and the augmentable
`AppEvents` interface. Declare an application event before dispatching it:

~~~ts
import { dispatch, listen } from '@stacksjs/events'

declare module '@stacksjs/events' {
  interface AppEvents {
    'invoice:settled': { id: number, total: number }
  }
}

listen('invoice:settled', invoice => {
  console.log(invoice.id, invoice.total)
})
dispatch('invoice:settled', { id: 1, total: 1200 })
~~~

Built-in auth names include `user:registered`, `user:logged-in`,
`user:logged-out`, `user:password-reset` and `user:password-changed`.
Read their payload types from `core/events/src/index.ts` rather than guessing.

## Application listeners

`app/Events.ts` default-exports `defineEvents({ event: [listenerName] })`.
Names resolve against application listeners, application actions, then framework
defaults. A standalone module in `app/Listeners/` may instead default-export
`defineListener({ listensTo, handle })`. Its handler is `(payload, eventName)`,
including for a glob subscription, because the discovery layer adapts the bus.

`registerAppListeners()` loads both conventions at boot and deduplicates each
event/module pair. `injectGlobalAutoImports()` calls it for HTTP, CLI, scheduler
and seeding entrypoints. `app/Listener.ts` may call the same registration hook.
Adding a listener requires a process restart. See `stacks-listeners` for files.

## Model lifecycle

`traits.observe` opts a model into lifecycle events. Before events are
`saving`, `creating`, `updating` and `deleting`; after events are
`created`, `updated`, `deleted` and `saved`. Names lowercase the model
name, for example `teammember:saved`.

Before handlers receive the model object, with its row under `.attributes`;
returning exactly false cancels the write. After handlers receive the row.
The ORM awaits the before-event result; that is separate from ordinary
fire-and-forget application dispatch. See `stacks-models` and `stacks-orm`
for which writes emit hooks, bulk operations and transaction boundaries.
Model event types derive from the models barrel in
`storage/framework/types/model-events.d.ts`.

## Isolation and cleanup

`createEmitter<EventMap>()` creates an isolated emitter; the compatibility
`mitt`/default export is its alias. The application singleton uses a global
symbol so duplicate installed copies share the same bus in one process.
It is not cross-process messaging.

`once` removes its listener after the first invocation. `off(name, handler)`
removes by identity; `off(name)` clears that bucket.
`emitter.removeAllListeners(name?)` removes a bucket or all listeners;
`listenerCount(name)` counts only the exact bucket, not matching patterns.
`scopedEvents(prefix)` and `scope(emitter, prefix)` provide prefixed names
without creating another bus. Read their prefix composition in the source
before combining them with an application's named events.

## Source and verification

- Public API and async behavior: `storage/framework/core/events/src/index.ts`.
- Discovery and typed listener adapters: `core/events/src/discover.ts`.
- Retained tests: `native-emitter.test.ts`, `priority-and-collect.test.ts`,
  `scope.test.ts`, `register.test.ts`, `shared-emitter.test.ts` under
  `storage/framework/core/events/tests/`.
