import { afterEach } from 'bun:test'
import { events } from '@stacksjs/events'

/**
 * Event fakes for feature tests (stacksjs/stacks#2581).
 *
 * `docs/testing/feature-tests.md` has documented `eventFake()` and
 * `getDispatchedEvents()` for a long time against a package that exported
 * neither. They are worth having rather than deleting: asserting that
 * registering a user FIRES `UserRegistered` is a different test from asserting
 * what the listener then did, and without a fake the two are stuck together.
 *
 * `@stacksjs/queue` already has the same pair for jobs (`fake()`,
 * `getFakeQueue()`, `restore()`), so this follows it.
 */

/** One event as it was dispatched. */
export interface DispatchedEvent {
  type: string
  payload: unknown
}

/**
 * The handlers a fake displaced, kept so `restoreEvents()` can put them back.
 *
 * `null` means no fake is active. It is not `[]`: an application with no
 * listeners registered would be indistinguishable from one that was never
 * faked, and restoring then would be a silent no-op that leaves the recorder
 * installed.
 */
// The map's key and value types are generated from every model in the app, so
// they are carried as `unknown` and cast back on restore. Nothing reads the
// handlers in between - they are moved, not called.
let displaced: Array<[unknown, unknown]> | null = null
let recorded: DispatchedEvent[] = []

/** The recorder, kept as one value so it can be removed by identity. */
const record = (type: string | symbol, payload: unknown): void => {
  recorded.push({ type: String(type), payload })
}

/**
 * Record every dispatched event and stop the real listeners from running.
 *
 * Suppression is the point, not a side effect. A feature test asserting that
 * an event fired should not also send the welcome email, write the audit row,
 * and reindex the model - those are the listeners' own tests. The handlers are
 * taken off the shared emitter and put back by `restoreEvents()`, which is
 * wired to `afterEach` automatically so a test that forgets cannot leak a
 * silenced event bus into the next one.
 */
export function eventFake(): void {
  if (displaced)
    return

  // `events.all` is the live map `emit` reads from, so removing an entry from
  // it genuinely stops that handler firing.
  displaced = [...events.all.entries()] as Array<[unknown, unknown]>
  events.all.clear()
  recorded = []
  events.on('*', record)
}

/** Whether a fake is currently installed. */
export function eventsAreFaked(): boolean {
  return displaced !== null
}

/**
 * Events dispatched since `eventFake()`, optionally filtered by type.
 *
 * Returns a copy, so a test holding the result across further dispatches sees
 * what it asked for rather than a list that keeps growing under it.
 */
export function getDispatchedEvents(type?: string): DispatchedEvent[] {
  if (!displaced) {
    throw new Error(
      'getDispatchedEvents() was called without eventFake(). '
      + 'Nothing is recording, so an empty result would look like "the event did not fire".',
    )
  }
  return type === undefined ? [...recorded] : recorded.filter(event => event.type === type)
}

/** Whether an event of this type was dispatched at least once. */
export function hasDispatchedEvent(type: string): boolean {
  return getDispatchedEvents(type).length > 0
}

/** Put the real listeners back and forget what was recorded. */
export function restoreEvents(): void {
  if (!displaced)
    return

  events.off('*', record)
  events.all.clear()
  for (const [type, handlers] of displaced)
    events.all.set(type as never, handlers as never)

  displaced = null
  recorded = []
}

// A faked event bus that outlived its test is the worst kind of shared state:
// the NEXT test's events silently do nothing, and it fails somewhere else.
afterEach(() => {
  restoreEvents()
})
