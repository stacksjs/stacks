/**
 * Work an application does once, before the first reader arrives.
 *
 * There was nowhere to put it. `app/Routes.ts` is a config object; a route file
 * runs at import time, which is before the router knows what it is serving; and
 * the shape people reach for instead is a module-level side effect in a file
 * they hope is imported - a boot hook that runs at a time nobody chose and
 * cannot be turned off.
 *
 * The case it was built for is a syntax highlighter whose first call in a
 * process pays for grammar parsing and JIT, once, and hands that second to
 * whichever reader happened to arrive first.
 */

import { describe, expect, it } from 'bun:test'
import { resetBootHooks, route, runBootHooks } from '../src/stacks-router'

describe('boot hooks', () => {
  it('runs what was registered, in the order it was registered', async () => {
    resetBootHooks()

    const order: string[] = []

    route.booting('first', () => { order.push('first') })
    route.booting('second', async () => {
      await Promise.resolve()
      order.push('second')
    })

    await runBootHooks()

    // Sequential rather than concurrent: every hook is doing work the first
    // request would otherwise do, and running them at once on a cold process
    // contends for the core that is about to serve.
    expect(order).toEqual(['first', 'second'])
  })

  it('runs them once, however many times a process serves', async () => {
    resetBootHooks()

    let runs = 0

    route.booting('counted', () => { runs += 1 })

    await runBootHooks()
    await runBootHooks()

    expect(runs).toBe(1)
  })

  it('survives one that throws, and keeps going', async () => {
    resetBootHooks()

    const ran: string[] = []

    route.booting('broken', () => { throw new Error('no') })
    route.booting('after', () => { ran.push('after') })

    // Not a rejection. Refusing to start a server because a cache could not be
    // pre-warmed is a worse failure than a slow first request - which is also
    // why anything an application *requires* belongs before `serve()` in its
    // own start path, where a rejection stops the process.
    await runBootHooks()

    expect(ran).toEqual(['after'])
  })

  it('survives one that rejects, for the same reason', async () => {
    resetBootHooks()

    const ran: string[] = []

    route.booting('rejects', async () => { throw new Error('no') })
    route.booting('after', () => { ran.push('after') })

    await runBootHooks()

    expect(ran).toEqual(['after'])
  })

  it('is chainable, like everything else on the router', () => {
    resetBootHooks()

    expect(route.booting('a', () => {})).toBe(route)
  })

  it('with nothing registered, does nothing and says nothing', async () => {
    resetBootHooks()

    await runBootHooks()

    expect(true).toBe(true)
  })
})
