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
import process from 'node:process'
import { defaults } from '../src/defaults'
import { defaultsForOverrides, overrides } from '../src/overrides'



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
    /*
     * Built here rather than read off the exported `overrides`.
     *
     * That object is a snapshot taken whenever this module was first evaluated
     * in the process - which, in a full-tree run, is before twelve other test
     * files that set `APP_ENV = 'testing'` at module scope for their database
     * setup. Asserting on it compared two different moments and failed for a
     * reason unrelated to the rule under test (stacksjs/stacks#2413). Calling
     * the builder pins the rule itself.
     */
    const saved = { name: process.env.APP_NAME, env: process.env.APP_ENV }

    try {
      process.env.APP_NAME = 'From The Environment'
      process.env.APP_ENV = 'staging'
      expect(defaultsForOverrides().app?.name).toBe('From The Environment')
      expect(defaultsForOverrides().app?.env).toBe('staging')

      delete process.env.APP_NAME
      delete process.env.APP_ENV
      expect(defaultsForOverrides().app?.name).toBe(defaults.app?.name || 'Stacks')
      expect(defaultsForOverrides().app?.env).toBe('production')
    }
    finally {
      for (const [key, value] of Object.entries({ APP_NAME: saved.name, APP_ENV: saved.env })) {
        if (value === undefined)
          delete process.env[key]
        else
          process.env[key] = value
      }
    }
  })
})
