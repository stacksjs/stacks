import { describe, expect, test } from 'bun:test'
import { closeDatabaseConnections } from '../src/connection-lifecycle'

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
})
