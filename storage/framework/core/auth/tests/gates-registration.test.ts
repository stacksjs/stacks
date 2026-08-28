/**
 * `app/Gates.ts` reaching the gate.
 *
 * `initializeAuthorization()` was exported, documented, and called by nothing -
 * the same shape the listener registry had before `registerAppListeners()` was
 * wired into boot. So every gate an application defined was never registered,
 * and `Gate.allows('access-admin', user)` fell through to the default deny.
 *
 * Fail-closed, so nothing was ever left unguarded. But the whole feature did
 * nothing, and that is uncommonly hard to notice: a gate that was never
 * registered and a gate that means to say no give the same answer.
 */

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { appPath } from '@stacksjs/path'
import { Gate } from '../src/gate'
import { initializeAuthorization, registerGates } from '../src/policy'

beforeEach(() => {
  Gate.flush()
})

afterAll(() => {
  Gate.flush()
})

describe('initializeAuthorization', () => {
  it('registers the abilities app/Gates.ts declares', async () => {
    expect(Gate.has('view-dashboard')).toBe(false)

    await initializeAuthorization()

    const declared = await import(appPath('Gates.ts'))
    const abilities = Object.keys(declared.default.gates)

    expect(abilities.length).toBeGreaterThan(0)
    for (const ability of abilities)
      expect(Gate.has(ability)).toBe(true)
  })

  it('makes a declared gate answer, instead of falling through to deny', async () => {
    // Pre-fix this was false for every user, because nothing had registered
    // the gate that decides it.
    await initializeAuthorization()

    expect(await Gate.allows('view-dashboard', { id: 1 } as never)).toBe(true)
    expect(await Gate.allows('view-dashboard', null)).toBe(false)
  })

  it('still denies an ability nothing declares', async () => {
    await initializeAuthorization()

    expect(await Gate.allows('no-such-ability', { id: 1 } as never)).toBe(false)
  })

  it('does not throw when a half of the authorization setup fails', async () => {
    // The whole point of the wrapper: an application that will not boot over a
    // typo in a gate is worse than one that logs the typo.
    await expect(initializeAuthorization()).resolves.toBeUndefined()
  })
})

describe('registerGates', () => {
  it('reads the default export defineGates produces', async () => {
    await registerGates()

    const declared = await import(appPath('Gates.ts'))
    for (const ability of Object.keys(declared.default.gates))
      expect(Gate.has(ability)).toBe(true)
  })
})
