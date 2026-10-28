import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resetShutdownHooks, route } from '@stacksjs/router'
import { shutDownApiServer } from '../src/helpers/api-shutdown'

/**
 * The production API server's SIGTERM (stacksjs/stacks#3034). It drained
 * requests and exited, and nothing else heard: a terminal session open at that
 * moment never recorded its close.
 */

function recorder() {
  const exits: number[] = []
  return { exits, exit: (code: number) => { exits.push(code) } }
}

describe('stopping the production API server', () => {
  it('runs the shutdown hooks and drains the server together, then exits once', async () => {
    resetShutdownHooks()
    const order: string[] = []
    let finishStop!: () => void
    const server = { stop: () => new Promise<void>((resolve) => { finishStop = resolve }).then(() => { order.push('drained') }) }
    route.stopping('sessions', async () => {
      await Bun.sleep(5)
      order.push('sessions closed')
    })
    const { exits, exit } = recorder()

    const stopping = shutDownApiServer(server, { graceMs: 5_000, exit })
    await Bun.sleep(20)

    // The hook finished while the server was still draining: neither waited on the other.
    expect(order).toEqual(['sessions closed'])
    expect(exits).toEqual([])
    finishStop()
    await stopping
    expect(order).toEqual(['sessions closed', 'drained'])
    expect(exits).toEqual([0])
  })

  it('exits at the end of the grace window when a hook hangs', async () => {
    const { exits, exit } = recorder()
    const stopping = shutDownApiServer({ stop: () => {} }, { graceMs: 20, exit, hooks: () => new Promise(() => {}) })

    await Bun.sleep(60)
    expect(exits).toEqual([0])
    void stopping
  })

  it('exits at the end of the grace window when the drain does not finish', async () => {
    const { exits, exit } = recorder()
    void shutDownApiServer({ stop: () => new Promise(() => {}) }, { graceMs: 20, exit, hooks: async () => {} })

    await Bun.sleep(60)
    expect(exits).toEqual([0])
  })

  it('still exits when stopping the server throws', async () => {
    const { exits, exit } = recorder()
    await shutDownApiServer({ stop: () => { throw new Error('already stopped') } }, { graceMs: 5_000, exit, hooks: async () => {} })
    expect(exits).toEqual([0])
  })

  it('is what the production entry runs on SIGTERM', () => {
    // Comments stripped, so prose about SIGTERM cannot satisfy this.
    const source = new Bun.Transpiler({ loader: 'ts' }).transformSync(
      readFileSync(fileURLToPath(new URL('../src/serve/api.ts', import.meta.url)), 'utf8'),
    )
    const handler = source.slice(source.indexOf('process.on("SIGTERM"'))

    expect(source).toContain('process.on("SIGTERM"')
    expect(handler.slice(0, 400)).toContain('shutDownApiServer(server')
  })
})
