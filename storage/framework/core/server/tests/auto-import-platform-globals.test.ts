/**
 * An app's auto-imports never replace a global the platform defines.
 *
 * HQ.training has a model named `Event` (a race on an athlete's calendar). The
 * server put every barrel export on globalThis with `Object.assign`, so the
 * model replaced the DOM `Event` class for the whole process, and `stripe`,
 * whose emitter `extends Event`, failed to load with "The superclass is not a
 * constructor". @stacksjs/payments turns any failure to load the SDK into "the
 * `stripe` package is not installed", so every checkout said that with the
 * package right there.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assignBarrelGlobals } from '../src/imports'

describe('auto-import globals and the platform', () => {
  it('leaves a platform global alone and says so', () => {
    const NativeEvent = Event
    const target: Record<string, unknown> = { Event: NativeEvent }
    const Model = { where: () => null }
    const skipped = assignBarrelGlobals(target, { Event: Model, Workout: { where: () => null } }, new Set(['Event']))
    expect(skipped).toEqual(['Event'])
    expect(target.Event).toBe(NativeEvent)
    expect(target.Workout).toBeDefined()
  })

  it('keeps Event a class something can extend after injection', () => {
    const target: Record<string, unknown> = { Event }
    assignBarrelGlobals(target, { Event: { where: () => null } }, new Set(Object.getOwnPropertyNames(globalThis)))
    const Base = target.Event as typeof Event
    class Emitted extends Base { constructor() { super('demo') } }
    expect(new Emitted().type).toBe('demo')
  })

  it('lets one barrel take over another barrel\'s name, as before', () => {
    const target: Record<string, unknown> = {}
    assignBarrelGlobals(target, { useProducts: 'functions' }, new Set())
    assignBarrelGlobals(target, { useProducts: 'later' }, new Set())
    expect(target.useProducts).toBe('later')
  })

  it('is how the server injects every barrel', () => {
    const source = readFileSync(join(import.meta.dir, '../src/imports.ts'), 'utf8')
    expect(source).toContain('assignBarrelGlobals(globalThis as Record<string, unknown>, mod, platformGlobalNames)')
    expect(source).not.toMatch(/Object\.assign\(globalThis, mod\)/)
  })
})
