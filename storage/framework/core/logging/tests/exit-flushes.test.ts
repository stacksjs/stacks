/**
 * `log.exit` — say it, then leave.
 *
 * The logger writes asynchronously and `process.exit` does not wait, so
 * `log.success(...)` immediately followed by `process.exit(0)` loses the
 * message. That is the shape almost every CLI command ends with, and the line
 * it drops is the only one the operator was watching for: the command prints
 * "Building…", does two minutes of correct work, and appears to have hung.
 *
 * The gap was already known for the failure path — `log.fatal` writes to
 * stderr synchronously and exits — but nothing covered success, which is the
 * case that happens on every run rather than on a bad one.
 */

import { describe, expect, it } from 'bun:test'
import { log } from '../src/index'

describe('log.exit', () => {
  it('is declared alongside the other terminal helpers', () => {
    expect(typeof log.exit).toBe('function')
    expect(typeof log.fatal).toBe('function')
    expect(typeof log.flush).toBe('function')
  })

  it('flushes before it exits', async () => {
    /*
     * Ordering is the whole point, so it is asserted rather than assumed:
     * exiting first is exactly the bug, and a version that called them the
     * other way round would pass any test that only checked both ran.
     */
    const order: string[] = []

    const realFlush = log.flush
    const realExit = process.exit

    log.flush = async () => { order.push('flush') }
    // Throwing stands in for "never returns", which is what exit does.
    process.exit = ((code?: number) => {
      order.push(`exit:${code}`)
      throw new Error('exited')
    }) as typeof process.exit

    try {
      await log.exit('done')
    }
    catch {
      /* the stub above */
    }
    finally {
      log.flush = realFlush
      process.exit = realExit
    }

    expect(order).toEqual(['flush', 'exit:0'])
  })

  it('carries a non-zero code through', async () => {
    const realFlush = log.flush
    const realExit = process.exit
    let seen: number | undefined

    log.flush = async () => {}
    process.exit = ((code?: number) => {
      seen = code
      throw new Error('exited')
    }) as typeof process.exit

    try {
      await log.exit(undefined, 3)
    }
    catch {
      /* the stub above */
    }
    finally {
      log.flush = realFlush
      process.exit = realExit
    }

    expect(seen).toBe(3)
  })

  it('reports a non-zero exit as an error, not a success', async () => {
    /*
     * `release` ends this way when a pinned check blocks the release. Logging
     * that at SUCCESS printed the reason the release stopped in green, under a
     * label saying it worked — the opposite of what happened, on the one line
     * the operator reads.
     */
    const realFlush = log.flush
    const realExit = process.exit
    const realError = log.error
    const realSuccess = log.success
    const levels: string[] = []

    log.flush = async () => {}
    log.error = (async (msg: string) => { levels.push(`error:${msg}`) }) as typeof log.error
    log.success = (async (msg: string) => { levels.push(`success:${msg}`) }) as typeof log.success
    process.exit = (() => { throw new Error('exited') }) as typeof process.exit

    try {
      try {
        await log.exit('blocked', 1)
      }
      catch { /* the stub above */ }

      try {
        await log.exit('shipped')
      }
      catch { /* the stub above */ }
    }
    finally {
      log.flush = realFlush
      log.error = realError
      log.success = realSuccess
      process.exit = realExit
    }

    expect(levels).toEqual(['error:blocked', 'success:shipped'])
  })
})
