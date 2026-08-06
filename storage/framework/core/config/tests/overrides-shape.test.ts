/**
 * The synchronous pre-load shape of `overrides`.
 *
 * `overrides` is exported synchronously and mutated in place by
 * `loadUserConfigs()` once the user's `config/*.ts` files finish loading. So
 * whatever it holds at module-eval time is what every consumer reads for a
 * window whose length depends on module load order.
 *
 * `defaultsForOverrides()` used to hand-write `app` as `{ name, env }` only.
 * `url` was therefore `undefined` until the async load landed, and
 * `config.test.ts`'s `expect(typeof app.url).toBe('string')` passed or failed
 * on whether that load happened to win the race. It reliably passed locally and
 * flipped `core/config` and `core/env` red in CI whenever something unrelated
 * perturbed the resolution graph — a tsconfig `paths` entry, a new package.json
 * dependency — with nothing in the diff to connect it to.
 *
 * The fallback now spreads the real `defaults.app`, so the pre-load shape is
 * complete. These tests pin that, since the failure mode is invisible until it
 * costs someone an afternoon.
 */

import { describe, expect, it } from 'bun:test'
import { defaults } from '../src/defaults'
import { overrides } from '../src/overrides'

describe('overrides pre-load shape', () => {
  it('carries app.url synchronously, before loadUserConfigs resolves', () => {
    // The specific key that was missing. `undefined` here is the bug.
    expect(typeof overrides.app?.url).toBe('string')
    expect(overrides.app?.url).toBeTruthy()
  })

  it('carries every key the real app defaults declare', () => {
    // Guards the whole shape, not just `url` — any future key added to
    // `defaults.app` but not reachable here reintroduces the same class of
    // load-order flake for a different assertion.
    for (const key of Object.keys(defaults.app ?? {}))
      expect(overrides.app).toHaveProperty(key)
  })

  it('still lets APP_NAME / APP_ENV win, as they did before', () => {
    // These two were the only keys the hand-written fallback set, and both
    // read from process.env. That behaviour has to survive the change.
    expect(overrides.app?.name).toBe(process.env.APP_NAME || defaults.app?.name || 'Stacks')
    expect(overrides.app?.env).toBe(process.env.APP_ENV || 'production')
  })
})
