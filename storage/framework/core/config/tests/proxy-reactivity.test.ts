import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'bun:test'
import { config, defaults, overrides, overridesReady } from '../src'
import { userConfigUrl } from '../src/overrides'

const temporaryProjects: string[] = []

afterEach(() => {
  for (const project of temporaryProjects.splice(0))
    rmSync(project, { recursive: true, force: true })
})

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
  it('resolves installed-project config without a tsconfig alias', () => {
    expect(userConfigUrl('database', '/app')).toBe('file:///app/config/database.ts')
  })

  it('loads config from an installed project without a tsconfig alias', () => {
    const project = mkdtempSync(join(tmpdir(), 'stacks-config-project-'))
    temporaryProjects.push(project)
    mkdirSync(join(project, 'config'))
    writeFileSync(join(project, 'config/database.ts'), 'export default { default: "sqlite", marker: "project-config" }\n')

    const overridesUrl = pathToFileURL(join(import.meta.dir, '../src/overrides.ts')).href
    writeFileSync(join(project, 'verify.ts'), [
      `const { overrides, overridesReady } = await import(${JSON.stringify(overridesUrl)})`,
      'await overridesReady',
      'console.log(overrides.database.marker)',
    ].join('\n'))

    const result = Bun.spawnSync({
      cmd: ['bun', 'verify.ts'],
      cwd: project,
      env: { ...process.env, SKIP_CONFIG_VALIDATION: 'true' },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString().trim()).toBe('project-config')
    expect(result.stderr.toString()).toBe('')
  })

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

  it('is not sealed and isExtensible - the engine must not freeze it', () => {
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

/**
 * Writing to `config`.
 *
 * There was no `set` trap, so an assignment fell through to the proxy's
 * function target - and on a function target that is not a silent no-op, it
 * throws `TypeError: Proxy handler's 'get' result of a non-configurable and
 * non-writable property should be the same value as the target's property`.
 * `config.services = {...}` was an exception from a line that reads like
 * ordinary assignment.
 *
 * The cost was not hypothetical. The socials suite worked around it by
 * capturing `config.services` once and mutating that object in place - but
 * `readMerged` returns `overrides[prop]` when it is a non-empty object and
 * `defaults[prop]` otherwise, so the captured object is one of *two*, and which
 * one wins depends on whether the project's config files have finished
 * loading. On CI the other half became authoritative mid-run and every
 * assertion expecting a configured provider failed, on a package whose source
 * was correct.
 */
describe('writing through the proxy', () => {
  const services = () => (config as any).services

  afterEach(() => {
    delete (overrides as any).__probe
    delete (overrides as any).services
  })

  it('accepts an assignment instead of throwing', () => {
    expect(() => { (config as any).__probe = { a: 1 } }).not.toThrow()
    expect((config as any).__probe).toEqual({ a: 1 })
  })

  it('writes into overrides, which is the half a read prefers', () => {
    ;(config as any).services = { apple: { clientId: 'org.example.web' } }

    // Read back through the proxy, and present in `overrides` rather than
    // having landed on the target where nothing would ever see it.
    expect((services() as any).apple).toEqual({ clientId: 'org.example.web' })
    expect((overrides as any).services).toEqual({ apple: { clientId: 'org.example.web' } })

    // The read is an OVERLAY on the defaults, not a replacement of them
    // (stacksjs/stacks#2411): setting one service does not delete the four the
    // framework ships, the same way a `config/services.ts` that names one
    // service does not delete the rest.
    expect(Object.keys(services()).sort()).toEqual(
      [...new Set([...Object.keys((defaults as any).services), 'apple'])].sort(),
    )
  })

  it('and a delete falls back to the defaults rather than to nothing', () => {
    ;(config as any).services = { apple: { clientId: 'org.example.web' } }
    delete (config as any).services

    // `readMerged` treats an absent or empty override as unset, so what is
    // left is the framework default - not `undefined`, which would make every
    // reader of a deleted section crash rather than see the shipped value.
    expect(services()).toEqual((defaults as any).services)
  })

  it('an empty object is treated as unset, which is what a read falls back on', () => {
    // Deliberate, and the socials suite depends on it: `{}` is what
    // `defaultsForOverrides()` seeds every section with, so an empty override
    // cannot be allowed to shadow the defaults.
    ;(config as any).services = {}

    expect(services()).toEqual((defaults as any).services)
  })
})

/**
 * A user's config section is laid OVER the framework default, not swapped for
 * it (stacksjs/stacks#2411).
 *
 * Returning the override wholesale meant every default sub-key the user's file
 * did not restate silently vanished. In the framework's own repo that dropped
 * 19 keys across 8 sections - `auth.cookie`, `dns.driver`, `database.logging`,
 * `library.webComponents` among them - which is how `generate:component-meta`
 * ended up writing `"tags": undefined` over a committed file.
 */
describe('config sections overlay their defaults', () => {
  it('keeps a default sub-key the override does not mention', () => {
    ;(config as any).library = { name: 'only-a-name' }

    // The name is the user's...
    expect((config as any).library.name).toBe('only-a-name')
    // ...and webComponents is still the framework's, rather than gone.
    expect((config as any).library.webComponents).toBeDefined()

    delete (config as any).library
  })

  it('lets the override win where the two disagree', () => {
    const shipped = (defaults as any).library.name
    ;(config as any).library = { name: 'mine' }

    expect((config as any).library.name).toBe('mine')
    expect((config as any).library.name).not.toBe(shipped)

    delete (config as any).library
  })

  it('merges nested objects rather than only the top level', () => {
    ;(config as any).library = { webComponents: { name: 'renamed' } }

    const wc = (config as any).library.webComponents
    expect(wc.name).toBe('renamed')
    // `tags` lives two levels down and was never mentioned, so it survives.
    expect(wc.tags).toEqual((defaults as any).library.webComponents.tags)

    delete (config as any).library
  })

  it('replaces arrays instead of concatenating them', () => {
    // Otherwise a config file could never REMOVE a default entry: opting out of
    // one shipped country code would be impossible if the two were merged.
    ;(config as any).security = { firewall: { countryCodes: ['DE'] } }

    expect((config as any).security.firewall.countryCodes).toEqual(['DE'])

    delete (config as any).security
  })

  it('treats an explicit undefined as "not stated" rather than "unset it"', () => {
    ;(config as any).library = { name: undefined }

    expect((config as any).library.name).toBe((defaults as any).library.name)

    delete (config as any).library
  })
})
