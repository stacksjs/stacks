import { describe, expect, it } from 'bun:test'
import { feature } from '@stacksjs/config'
import * as orm from '@stacksjs/orm'
import { resolveDashboardModel } from '../../../defaults/resources/functions/dashboard/model-access'

/**
 * A model whose feature is off is still exported and put on globalThis, as a
 * proxy that throws on `.where` and the other query methods (#2928). The
 * dashboard probed exactly `.where` to decide whether a global was a model, so
 * every gated model failed as "Model definition could not be loaded" on the
 * Models page instead of being left out, the way the sidebar leaves them out.
 *
 * Driven off the live flags, like the ORM's own test of the throw.
 */
const GATED = ['Cart', 'Manufacturer', 'FormField'] as const
const gateOf = { Cart: 'commerce', Manufacturer: 'commerce', FormField: 'forms' } as const

describe('dashboard model resolution', () => {
  it('leaves out a model whose feature is off, without throwing', async () => {
    await orm.ormReady
    const off = GATED.filter(name => !feature(gateOf[name]))
    // Every gated model on would make this vacuous; config ships them off.
    expect(off.length).toBeGreaterThan(0)
    for (const name of off) {
      expect((globalThis as Record<string, unknown>)[name]).toBe((orm as Record<string, unknown>)[name])
      expect(await resolveDashboardModel(name, { where() {} })).toBeNull()
    }
  })

  it('still resolves a loaded model', async () => {
    await orm.ormReady
    const User = await resolveDashboardModel('User')
    expect(typeof User.where).toBe('function')
  })

  it('still loads a model whose global is a built-in it does not replace', async () => {
    await orm.ormReady
    // globalThis.Request stays the fetch Request, so the ORM's Request model is
    // reached through its file. Treating every non-model global as "feature
    // off" would hide it.
    expect((globalThis as Record<string, unknown>).Request).not.toBe((orm as Record<string, unknown>).Request)
    const candidate = { where() {} }
    expect(await resolveDashboardModel('Request', candidate)).toBe(candidate)
  })
})
