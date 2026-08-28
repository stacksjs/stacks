/**
 * `app/Events.ts`, typed.
 *
 * The map used to be declared as `interface Events { [key: string]: string[] }`
 * and applied with `satisfies`. An index signature over both halves accepts
 * `{ 'user:registerd': ['SendWelcomEmail'] }` in full, and both halves of that
 * fail the same way at runtime: `registerFromMap` warns once into boot output
 * and the event is handled by nobody. Nothing here executes; it is checked by
 * `bun run typecheck`.
 */

import type { EventName, Events, ListenerName } from '../src'
import { defineEvents, defineListener } from '../src'

// ── the good case, and what it keeps ──────────────────────────────────────

const events = defineEvents({
  'user:registered': ['SendWelcomeEmail'],
  'user:created': ['NotifyUser'],
})

// Keys stay exactly what the file declares, rather than widening to `string`.
export const declaredKeys: 'user:registered' | 'user:created' = '' as keyof typeof events

// And so do the listener names, rather than widening to `ListenerName[]`.
export const firstListener: 'SendWelcomeEmail' = events['user:registered'][0]

// ── an event that does not exist ──────────────────────────────────────────

export function unknownEventName(): void {
  defineEvents({
    // @ts-expect-error 'user:registerd' is not declared on AppEvents or AuthEvents
    'user:registerd': ['SendWelcomeEmail'],
  })
}

/*
 * The same typo beside a valid entry. This is the case a plain
 * `T extends Events` constraint misses: excess-property checking is a
 * freshness rule that stops applying once inference has a matching property to
 * work with, so a one-key map was rejected and a two-key map was not.
 */
export function unknownEventNameBesideAGoodOne(): void {
  defineEvents({
    // @ts-expect-error 'user:registerd' is not declared on AppEvents or AuthEvents
    'user:registerd': ['SendWelcomeEmail'],
    'user:created': ['NotifyUser'],
  })
}

// ── a listener that is not on disk ────────────────────────────────────────

export function unknownListenerName(): void {
  defineEvents({
    // @ts-expect-error there is no SendWelcomEmail under app/Listeners or app/Actions
    'user:registered': ['SendWelcomEmail'],
    'user:created': ['NotifyUser'],
  })
}

// ── `satisfies Events` stays equivalent ───────────────────────────────────

export const viaSatisfies = {
  'user:registered': ['SendWelcomeEmail'],
  'user:created': ['NotifyUser'],
} satisfies Events

// ── the names the map is built from ───────────────────────────────────────

export const anEvent: EventName = 'user:registered'
export const aListener: ListenerName = 'SendWelcomeEmail'

// ── the other half of the convention: app/Listeners/*.ts ──────────────────

/*
 * `listensTo` was `string | string[]`, so a listener could subscribe to an
 * event that does not exist, be registered by the scan, never match, and look
 * like it was working for as long as nobody checked.
 */
export const listener = defineListener({
  listensTo: 'user:registered',
  handle: (user) => {
    // The payload follows from the name rather than being `unknown`.
    const email: string = user.email
    void email
  },
})

export function unknownSubscription(): void {
  defineListener({
    // @ts-expect-error 'user:registerd' is not an event, and not a glob either
    listensTo: 'user:registerd',
    handle: () => {},
  })
}

// A glob is a legal subscription, and gets the union of what the bus carries.
export const globbed = defineListener({
  listensTo: 'user:*',
  handle: (payload, event) => {
    void payload
    void event
  },
})

// Several events, one handler.
export const several = defineListener({
  listensTo: ['user:created', 'user:updated'],
  handle: (user, event) => {
    void user.email
    void event
  },
})

export const ok = true
