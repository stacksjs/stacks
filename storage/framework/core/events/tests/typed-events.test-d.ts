/**
 * Model events, typed.
 *
 * `storage/framework/types/events.ts` carried a banner saying it defined "the
 * event types emitted by models" and was written by nothing, so it drifted in
 * three directions at once: every payload was `Record<string, any>` - with its
 * own docblock telling you to "cast to your model's attribute type at the
 * listener site", the type declining to do the one thing it exists for - it
 * listed three events per model where models emit eight, and it listed whatever
 * models existed when somebody last edited it.
 *
 * `buddy generate:types` writes the real map now, as an augmentation of
 * `AppEvents`. Checked by `bun run typecheck`; nothing here executes.
 */

import { listen } from '../src'

// ── after-events carry the row ────────────────────────────────────────────

listen('user:created', (user) => {
  const email: string = user.email
  void email
})

listen('user:updated', (user) => { void user.name })

// `:saved` fires for both insert and update, and was not a known event at all.
listen('user:saved', (user) => { void user.email })

listen('user:deleted', (user) => { void user.id })

export function unknownColumns(): void {
  listen('user:created', (user) => {
    // @ts-expect-error there is no such column on a User row
    void user.emial
  })
}

// ── before-events carry the model object, and can cancel ──────────────────

listen('user:saving', (model) => {
  // Established by `toEventPayload` reading `model?.attributes`.
  void model.attributes.email
})

// Returning `false` cancels the write. The handler type said `void`, so the
// documented way to refuse a save did not compile.
listen('user:creating', () => false)
listen('user:updating', () => false)
listen('user:deleting', () => false)

// ── the framework's own auth events still resolve ─────────────────────────

listen('user:registered', (user) => { void user.email })
listen('user:logged-in', (user) => { void user.id })

export const ok = true
