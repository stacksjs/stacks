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

/*
 * Optionality comes from the rules. A field whose rule went through
 * `.required()` is a required key; everything else is optional and the handler
 * has to guard it. Before this, every declared field typed as present - so a
 * payload that legitimately omits one handed the handler a `string` that was
 * `undefined` at runtime.
 */
const notify = new Action({
  name: 'Notify',
  invocation: 'event',
  validations: {
    id: { rule: schema.number().integer().positive().required() },
    name: { rule: schema.string().required() },
    nickname: { rule: schema.string() },
  },
  async handle(user) {
    const id: number = user.id
    const name: string = user.name
    // Not `string`: nothing declared it required.
    const nickname: string | undefined = user.nickname
    return { id, name, nickname }
  },
})

export async function payloadIsTyped(): Promise<void> {
  await notify.handle({ id: 1, name: 'x' })

  // The optional one may simply be absent.
  await notify.handle({ id: 1, name: 'x', nickname: 'xx' })

  // @ts-expect-error `id` is a number, from its validation rule
  await notify.handle({ id: 'one', name: 'x' })

  // @ts-expect-error `name` went through `.required()`
  await notify.handle({ id: 1 })
}

/*
 * `.required()` has to survive whatever follows it in the chain. It did not
 * always: the marker sat on `required()` alone, so `.required().min(5)` handed
 * back the plain validator and dropped it - which made whether a field read as
 * required depend on WHERE in the chain it was written, and
 * `schema.string().required().min(5).max(100)` is how the models are written.
 */
const chainOrder = new Action({
  name: 'ChainOrder',
  invocation: 'event',
  validations: {
    first: { rule: schema.string().required().min(5).max(100) },
    last: { rule: schema.string().min(5).max(100).required() },
  },
  async handle(payload) {
    const first: string = payload.first
    const last: string = payload.last
    return { first, last }
  },
})

export const orderDoesNotMatter = chainOrder

// ── http-invoked: handle receives a request, keyed by validations ─────────

const store = new Action({
  name: 'Store',
  path: '/posts/{postId}/comments',
  validations: {
    body: { rule: schema.string().required() },
    rating: { rule: schema.number().required() },
    // Not required, so `get()` hands back something the handler has to guard -
    // which is the whole point: an optional field that types as present is the
    // type saying something the runtime does not.
    note: { rule: schema.string() },
  },
  async handle(request) {
    const body: string = request.get('body')
    const rating: number = request.get('rating')
    const note: string | undefined = request.get('note')

    // Path params are reachable through `get()` too, because the runtime
    // merges them into the same input bag. This used to be `any` while
    // `request.params.postId` beside it was `string`.
    const viaGet: string = request.get('postId')
    const viaParams: string = request.params.postId

    // A key that is neither stays open: query strings carry keys no
    // validation block mentions, and rejecting them would be wrong.
    const openEnded = request.get('page')

    return { body, rating, note, viaGet, viaParams, openEnded }
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

// ── the action names `runAction` accepts ──────────────────────────────────

/*
 * `runAction`'s parameter was
 *
 *   type ActionPath = string // TODO: narrow this by automating its generation
 *   type ActionName = string // TODO: narrow this by automating its generation
 *   type Action = ActionPath | ActionName | string
 *
 * All three members were `string`, so the union collapsed to `string`: no name
 * was checked and none was offered as a completion. The registry those TODOs
 * ask for exists - it is the same auto-imports name map `schedule.action()`
 * already reads - so it is wired up here too.
 *
 * The parameter stays OPEN via `(string & {})`, because a genuinely dynamic
 * path is legitimate: `runAction('dev/views')` is a framework entry point, and
 * a `/actions/:name` route passes one straight through. What `(string & {})`
 * buys over a bare `string` is that the declared names survive as completions
 * instead of being erased.
 */

import type { RunnableActionName } from '../src/helpers/utils'

declare const someString: string

// The registry is populated: an arbitrary string is NOT one of the names.
// If this stops failing, the augmentation has silently gone missing and the
// name type has fallen back to `string`, constraining nothing.
// @ts-expect-error - `string` is wider than the declared action names.
export const registryIsPopulated: RunnableActionName = someString

// A real action resolves.
export const knownAction: RunnableActionName = 'Actions/SendWelcomeEmail'
