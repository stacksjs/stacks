/**
 * The unvendor install survives a release that is still propagating.
 *
 * Registry metadata lists a new version before its tarball can be fetched, so
 * `buddy new` run minutes after a release resolved `@stacksjs/*@^0.74.60` to
 * 0.74.61, got a 404 for every tarball, and left the project half converted.
 * The install is now retried on a schedule; these pin that schedule down
 * without spawning anything or waiting on a real clock.
 */
import { describe, expect, it } from 'bun:test'
import { INSTALL_RETRY_DELAYS_MS, installWithRetry } from '../src/unvendor-rewrite'

function scripted(codes: number[]) {
  let calls = 0
  return {
    run: async () => codes[Math.min(calls++, codes.length - 1)],
    calls: () => calls,
  }
}

describe('installWithRetry', () => {
  it('runs once when the first install succeeds', async () => {
    const install = scripted([0])
    const slept: number[] = []

    expect(await installWithRetry(install.run, { sleep: async ms => void slept.push(ms) })).toBe(0)
    expect(install.calls()).toBe(1)
    expect(slept).toEqual([])
  })

  it('retries a failure until an attempt succeeds', async () => {
    const install = scripted([1, 1, 0])
    const slept: number[] = []
    const retries: number[] = []

    const code = await installWithRetry(install.run, {
      delaysMs: [10, 20, 30],
      sleep: async ms => void slept.push(ms),
      onRetry: attempt => void retries.push(attempt),
    })

    expect(code).toBe(0)
    expect(install.calls()).toBe(3)
    expect(slept).toEqual([10, 20])
    expect(retries).toEqual([2, 3])
  })

  it('gives up after the schedule and returns the last failure', async () => {
    const install = scripted([1, 1, 7])

    expect(await installWithRetry(install.run, { delaysMs: [1, 1], sleep: async () => {} })).toBe(7)
    expect(install.calls()).toBe(3)
  })

  it('waits long enough by default to outlast a release still publishing', () => {
    const total = INSTALL_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0)

    // The 404 window observed on 0.74.61 lasted seven minutes (17:29 to 17:36 UTC).
    expect(total).toBeGreaterThan(7 * 60_000)
  })
})
