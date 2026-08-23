/**
 * What an action's `handle` is handed, and what it knows about it.
 *
 * Two shapes, and until now only one of them was expressible without four
 * positional type arguments - so nearly every event-invoked action was written
 * against a request that never arrives. `app/Events.ts` maps an event onto an
 * action name and the event system calls `handle(payload, event)`; an action
 * written as `request.get('id')` threw `request.get is not a function` the
 * first time its event fired, and nothing in the types disagreed.
 *
 * Checked by `bun run typecheck`; nothing here executes.
 */

import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'

// ── event-invoked: handle receives the payload, typed by validations ──────

const notify = new Action({
  name: 'Notify',
  invocation: 'event',
  validations: {
    id: { rule: schema.number() },
    name: { rule: schema.string() },
  },
  async handle(user) {
    const id: number = user.id
    const name: string = user.name
    return { id, name }
  },
})

export async function payloadIsTyped(): Promise<void> {
  await notify.handle({ id: 1, name: 'x' })

  // @ts-expect-error `id` is a number, from its validation rule
  await notify.handle({ id: 'one', name: 'x' })

  // @ts-expect-error `name` is declared, so it is required
  await notify.handle({ id: 1 })
}

// ── http-invoked: handle receives a request, keyed by validations ─────────

const store = new Action({
  name: 'Store',
  path: '/posts/{postId}/comments',
  validations: {
    body: { rule: schema.string() },
    rating: { rule: schema.number() },
  },
  async handle(request) {
    const body: string = request.get('body')
    const rating: number = request.get('rating')

    // Path params are reachable through `get()` too, because the runtime
    // merges them into the same input bag. This used to be `any` while
    // `request.params.postId` beside it was `string`.
    const viaGet: string = request.get('postId')
    const viaParams: string = request.params.postId

    // A key that is neither stays open: query strings carry keys no
    // validation block mentions, and rejecting them would be wrong.
    const openEnded = request.get('page')

    return { body, rating, viaGet, viaParams, openEnded }
  },
})

export const stored = store

// ── no validations: unchanged, everything stays open ──────────────────────

const bare = new Action({
  name: 'Bare',
  async handle(request) {
    const anything = request.get('whatever')
    return { anything }
  },
})

export const untouched = bare
