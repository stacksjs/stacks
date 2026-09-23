import { describe, expect, test } from 'bun:test'
import { closeDatabaseConnections, closeDatabaseConnectionsAndPending, retireDatabaseConnections } from '../src/connection-lifecycle'

describe('database connection lifecycle', () => {
  test('waits for every distinct connection to finish closing', async () => {
    const firstRelease = Promise.withResolvers<void>()
    const secondRelease = Promise.withResolvers<void>()
    const calls: string[] = []
    const first = {
      async close() {
        calls.push('first:start')
        await firstRelease.promise
        calls.push('first:end')
      },
    }
    const second = {
      async close() {
        calls.push('second:start')
        await secondRelease.promise
        calls.push('second:end')
      },
    }

    let settled = false
    const closing = closeDatabaseConnections([first, first, second]).then(() => {
      settled = true
    })
    await Promise.resolve()

    expect(calls).toEqual(['first:start', 'second:start'])
    expect(settled).toBe(false)
    firstRelease.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    secondRelease.resolve()
    await closing

    expect(calls).toEqual(['first:start', 'second:start', 'first:end', 'second:end'])
    expect(settled).toBe(true)
  })

  test('drains the remaining connections before reporting close failures', async () => {
    const calls: string[] = []
    const failure = new Error('primary close failed')

    await expect(closeDatabaseConnections([
      { close: async () => { throw failure } },
      { close: async () => { calls.push('replica closed') } },
    ])).rejects.toBe(failure)

    expect(calls).toEqual(['replica closed'])
  })

  test('shutdown waits for a connection retired by reset', async () => {
    const release = Promise.withResolvers<void>()
    const pending = new Set<Promise<void>>()
    let closeStarted = false
    let closeFinished = false
    retireDatabaseConnections(pending, [{
      async close() {
        closeStarted = true
        await release.promise
        closeFinished = true
      },
    }], (error) => {
      throw error
    })

    expect(closeStarted).toBe(true)
    let shutdownFinished = false
    const shutdown = closeDatabaseConnectionsAndPending([], pending).then(() => {
      shutdownFinished = true
    })
    await Promise.resolve()
    expect(shutdownFinished).toBe(false)

    release.resolve()
    await shutdown
    expect(closeFinished).toBe(true)
    expect(shutdownFinished).toBe(true)
  })

  test('a synchronous close failure still starts and drains the remaining pools', async () => {
    const failure = new Error('synchronous close failure')
    const release = Promise.withResolvers<void>()
    const calls: string[] = []
    let settled = false
    const closing = closeDatabaseConnections([
      { close: () => { throw failure } },
      {
        async close() {
          calls.push('replica:start')
          await release.promise
          calls.push('replica:end')
        },
      },
    ]).catch((error) => {
      settled = true
      return error
    })

    await Promise.resolve()
    expect(calls).toEqual(['replica:start'])
    expect(settled).toBe(false)
    release.resolve()
    expect(await closing).toBe(failure)
    expect(calls).toEqual(['replica:start', 'replica:end'])
  })

  test('aggregates synchronous and asynchronous failures after closing healthy pools', async () => {
    const first = new Error('sync failure')
    const second = new Error('async failure')
    let healthyClosed = false
    const error = await closeDatabaseConnections([
      { close: () => { throw first } },
      { close: async () => { throw second } },
      { close: () => { healthyClosed = true } },
    ]).catch(error => error)

    expect(healthyClosed).toBe(true)
    expect(error).toBeInstanceOf(AggregateError)
    expect(error.errors).toEqual([first, second])
  })
})
