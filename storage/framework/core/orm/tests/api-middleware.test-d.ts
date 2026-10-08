/**
 * `ApiMiddleware` accepts every form the generator resolves, and rejects a
 * misspelled one (stacksjs/stacks#2883).
 *
 * The runtime grew the read/write split in #2224 and the per-ability override
 * in #2883. A type that lags either one makes the feature unreachable without
 * a cast, which is the same "declared but not honoured" gap in the other
 * direction - so the forms are pinned here rather than left to the docs.
 */

import type { ApiMiddleware } from '@stacksjs/types'

// Flat forms, unchanged since #1949.
export const flat: ApiMiddleware = ['auth']
export const shorthand: ApiMiddleware = 'auth'
export const openedOnPurpose: ApiMiddleware = []

// The #2224 split.
export const split: ApiMiddleware = { read: [], write: ['auth'] }
export const oneSide: ApiMiddleware = { write: ['auth'] }

// The #2883 per-ability override: the shape a tiered app needs, where a role
// loses one action rather than the whole write side.
export const ability: ApiMiddleware = { destroy: ['auth', 'role:admin'] }
export const abilityBesideSide: ApiMiddleware = { write: ['auth'], destroy: ['auth', 'role:admin'] }
export const abilityShorthand: ApiMiddleware = { destroy: 'role:admin' }
export const everyAbility: ApiMiddleware = {
  index: ['auth'],
  show: ['auth'],
  store: ['auth'],
  update: ['auth'],
  destroy: ['auth', 'role:admin'],
}

// A typo has to be a type error. Silently ignoring `destry` would leave the
// delete route on the write side's list while the model reads as if it were
// gated, which is the whole failure mode this issue is about.
// @ts-expect-error unknown ability
export const typo: ApiMiddleware = { destry: ['auth'] }

// A side or ability given a non-string list is rejected too.
// @ts-expect-error numbers are not middleware names
export const wrongType: ApiMiddleware = { destroy: [42] }
