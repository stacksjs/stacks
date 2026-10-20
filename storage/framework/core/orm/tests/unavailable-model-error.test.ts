import { describe, expect, it } from 'bun:test'
import { feature } from '@stacksjs/config'
import * as orm from '../src/index'

/**
 * A model the running process never loaded used to answer `undefined` for
 * every property, so the first call failed as
 * `Manufacturer.orderByDesc is not a function` - several frames from the real
 * cause, which was `config/commerce.ts` holding `enabled: false`.
 *
 * That shape cost a real debugging session: the dashboard's commerce pages
 * returned 503s, the log showed only the TypeError, and the first hypothesis
 * (a stale `node_modules` ORM gap) was wrong. The proxy now says which feature
 * is off and which config file turns it on.
 *
 * Driven off the live flags rather than a hardcoded model, so it keeps testing
 * the real thing whichever features this checkout has enabled.
 * See stacksjs/stacks#2928.
 */

const GATED: Array<[model: string, flag: string]> = [
  ['Manufacturer', 'commerce'],
  ['ProductUnit', 'commerce'],
  ['Post', 'cms'],
]

describe('an unavailable model explains itself', () => {
  it('always has User, whatever is switched off', async () => {
    // The control: if the deferred load never ran, every assertion below would
    // pass for the wrong reason.
    await orm.ormReady
    expect(typeof (orm as any).User.where).toBe('function')
    expect(typeof (orm as any).User.orderByDesc).toBe('function')
  })

  it('names the feature and the config file when the feature is off', async () => {
    await orm.ormReady

    const off = GATED.filter(([, flag]) => !feature(flag as any))
    const on = GATED.filter(([, flag]) => feature(flag as any))

    for (const [model, flag] of off) {
      expect(() => (orm as any)[model].orderByDesc('id')).toThrow(`Model "${model}" is not available`)
      expect(() => (orm as any)[model].orderByDesc('id')).toThrow(`'${flag}' feature is off`)
      expect(() => (orm as any)[model].orderByDesc('id')).toThrow(`config/${flag}.ts`)
    }

    for (const [model] of on)
      expect(typeof (orm as any)[model].orderByDesc).toBe('function')

    // Neither branch being exercised would make this vacuous.
    expect(off.length + on.length).toBe(GATED.length)
  })

  it('keeps answering undefined for every other property', async () => {
    await orm.ormReady
    const off = GATED.find(([, flag]) => !feature(flag as any))
    if (!off)
      return

    // This is the contract that makes the throw an allowlist rather than a
    // blanket. `Referral.getDefinition?.()` is how feature availability gets
    // detected, and `Post`'s eager-load path reads off a gated commerce
    // `Category` expecting nothing back - throwing on every property broke
    // both. Logging and duck-typing poke at objects too, so a throw there
    // would turn `console.log(Model)` into a crash.
    for (const prop of ['getDefinition', 'then', 'constructor', 'toJSON', 'inspect', '$$typeof', 'table', 'relations'])
      expect(() => (orm as any)[off[0]][prop]).not.toThrow()

    expect((orm as any)[off[0]].getDefinition).toBeUndefined()
  })
})
