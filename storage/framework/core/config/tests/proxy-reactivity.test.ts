import { describe, expect, it } from 'bun:test'
import { config, defaults, overrides, overridesReady } from '../src'

// Regression coverage for the config proxy / live-binding fix.
//
// Before the fix:
//   - `index.ts` had `export * as config from './config'` AND `export *
//     from './config'`, which left consumers binding to a sealed
//     namespace object instead of the live proxy. `config.X` returned
//     stale snapshots forever.
//   - The per-section exports (`export const ports = config.ports`)
//     captured an empty-default snapshot at module-load and never
//     updated, so `import { ports } from '@stacksjs/config'` always
//     returned the framework defaults.
//
// These tests pin both behaviours so a future "tidy up the index"
// refactor can't silently regress either of them.
describe('config proxy', () => {
  it('exposes a live, mutating proxy under `config`', async () => {
    await overridesReady

    // Mutating overrides[ports] should be visible through the proxy.
    // Use a fresh key to avoid clobbering real config.
    ;(overrides as any).__proxyTestKey = { value: 'first' }
    expect((config as any).__proxyTestKey?.value).toBe('first')

    ;(overrides as any).__proxyTestKey = { value: 'second' }
    expect((config as any).__proxyTestKey?.value).toBe('second')
  })

  it('falls through to defaults when the override slot is empty', async () => {
    await overridesReady

    // Pick a key that exists on defaults. Replacing with an empty `{}`
    // should make the proxy fall back to the defaults shape rather than
    // returning the empty object.
    const defaultPorts = (defaults as any).ports
    expect(defaultPorts).toBeDefined()

    ;(overrides as any).ports = {}
    expect((config as any).ports).toBe(defaultPorts)
  })

  it('is not sealed and isExtensible — the engine must not freeze it', () => {
    expect(Object.isSealed(config)).toBe(false)
    expect(Object.isExtensible(config)).toBe(true)
  })
})

describe('section exports (live bindings)', () => {
  it('reflect the merged value after overridesReady resolves', async () => {
    // Re-import to read the live binding after await. ESM lets us pull
    // the same export multiple times and always see the current value.
    const mod = await import('../src')
    await mod.overridesReady

    // After the loader runs, `mod.email.default` should match
    // `mod.config.email.default`. Pre-fix, the const captured the
    // pre-load snapshot (`undefined` here) and stayed there forever.
    expect(mod.email).toEqual(mod.config.email as any)
  })
})
