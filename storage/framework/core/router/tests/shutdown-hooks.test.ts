/**
 * Work an application does when the server is told to stop (stacksjs/stacks#3034).
 *
 * The production API server stopped accepting requests and exited, and nothing
 * else heard about it: a terminal session open at that moment never recorded
 * its close, and left its temp directory behind. `route.stopping` is where such
 * work registers, and the server runs it on SIGTERM.
 */

import type { ShutdownHook } from '../src/stacks-router'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { resetShutdownHooks, route, runShutdownHooks } from '../src/stacks-router'

// The list is process-wide and the suite shares a process: a module loaded by
// an earlier test file (the terminal sessions) registered its hook already,
// and resetting here must not take it away from a later file.
const registry = () => (globalThis as Record<symbol, { hooks: ShutdownHook[] }>)[Symbol.for('@stacksjs/router:shutdown-hooks')]
let registeredBefore: ShutdownHook[] = []

beforeAll(() => {
  registeredBefore = [...(registry()?.hooks ?? [])]
})

afterAll(() => {
  resetShutdownHooks()
  registry()!.hooks.push(...registeredBefore)
})

describe('shutdown hooks', () => {
  it('runs every registered hook', async () => {
    resetShutdownHooks()

    const ran: string[] = []

    route.stopping('first', () => { ran.push('first') })
    route.stopping('second', async () => {
      await Promise.resolve()
      ran.push('second')
    })

    await runShutdownHooks()

    expect(ran.sort()).toEqual(['first', 'second'])
  })

  it('runs them at once, so one hook waiting does not spend the others\' grace window', async () => {
    resetShutdownHooks()

    let release!: () => void
    let fastRan = false

    route.stopping('slow', () => new Promise<void>((resolve) => { release = resolve }))
    route.stopping('fast', () => { fastRan = true })

    const running = runShutdownHooks()
    await Promise.resolve()

    // The slow one has not finished, and the fast one did not wait for it.
    expect(fastRan).toBe(true)
    release()
    await running
  })

  it('runs them once, however many signals arrive', async () => {
    resetShutdownHooks()

    let runs = 0

    route.stopping('counted', async () => {
      await Bun.sleep(5)
      runs += 1
    })

    // A second SIGTERM while the first is still closing waits on the same run.
    await Promise.all([runShutdownHooks(), runShutdownHooks()])
    await runShutdownHooks()

    expect(runs).toBe(1)
  })

  it('survives one that throws, and still runs the rest', async () => {
    resetShutdownHooks()

    const ran: string[] = []

    route.stopping('broken', () => { throw new Error('no') })
    route.stopping('after', () => { ran.push('after') })

    await expect(runShutdownHooks()).resolves.toBeUndefined()
    expect(ran).toEqual(['after'])
  })

  it('keeps the list on globalThis, so a second copy of the router reaches the same one', async () => {
    resetShutdownHooks()

    let ran = false

    // What a module registering through another copy of this package does.
    const hooks = (globalThis as Record<symbol, { hooks: Array<{ name: string, run: () => void }> }>)[Symbol.for('@stacksjs/router:shutdown-hooks')]!
    hooks.hooks.push({ name: 'elsewhere', run: () => { ran = true } })

    await runShutdownHooks()

    expect(ran).toBe(true)
  })
})
