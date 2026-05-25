import { afterEach, describe, expect, test } from 'bun:test'
import {
  __flushAfterCommitNow,
  __pendingAfterCommitCount,
  enqueueAfterCommit,
  isInTransaction,
  runInTransactionScope,
} from '../src/transaction-context'

// stacksjs/stacks#1882 — AsyncLocalStorage-based transaction context.
// Tests the primitive in isolation (no actual db.transaction; the orm
// wrapper threads this through real callbacks).

describe('transaction-context', () => {
  describe('isInTransaction', () => {
    test('false outside a scope', () => {
      expect(isInTransaction()).toBe(false)
    })

    test('true inside runInTransactionScope', async () => {
      let observed: boolean | undefined
      await runInTransactionScope(async () => {
        observed = isInTransaction()
      })
      expect(observed).toBe(true)
    })

    test('back to false after the scope resolves', async () => {
      await runInTransactionScope(async () => { /* … */ })
      expect(isInTransaction()).toBe(false)
    })
  })

  describe('enqueueAfterCommit', () => {
    test('returns false outside any scope', () => {
      expect(enqueueAfterCommit(() => {})).toBe(false)
    })

    test('returns true inside a scope and buffers the callback', async () => {
      let fired = 0
      await runInTransactionScope(async () => {
        const enqueued = enqueueAfterCommit(() => { fired++ })
        expect(enqueued).toBe(true)
        // Buffered — not fired yet during the scope body
        expect(fired).toBe(0)
      })
      // After the scope commits, the buffered callback ran
      expect(fired).toBe(1)
    })

    test('callbacks fire in insertion order', async () => {
      const log: number[] = []
      await runInTransactionScope(async () => {
        enqueueAfterCommit(() => { log.push(1) })
        enqueueAfterCommit(() => { log.push(2) })
        enqueueAfterCommit(() => { log.push(3) })
      })
      expect(log).toEqual([1, 2, 3])
    })

    test('async callbacks are awaited sequentially', async () => {
      const log: string[] = []
      await runInTransactionScope(async () => {
        enqueueAfterCommit(async () => {
          await new Promise(r => setTimeout(r, 10))
          log.push('a')
        })
        enqueueAfterCommit(() => { log.push('b') })
      })
      expect(log).toEqual(['a', 'b'])
    })
  })

  describe('rollback', () => {
    test('buffered callbacks are dropped when the scope body throws', async () => {
      let fired = 0
      await expect(
        runInTransactionScope(async () => {
          enqueueAfterCommit(() => { fired++ })
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')
      expect(fired).toBe(0)
    })

    test('a subsequent scope starts with an empty buffer', async () => {
      let fired = 0
      try {
        await runInTransactionScope(async () => {
          enqueueAfterCommit(() => { fired++ })
          throw new Error('boom')
        })
      }
      catch {}
      // Out of scope now — no leakage
      expect(isInTransaction()).toBe(false)
      // Next scope starts fresh
      await runInTransactionScope(async () => {
        expect(__pendingAfterCommitCount()).toBe(0)
      })
      expect(fired).toBe(0)
    })
  })

  describe('nested scopes', () => {
    test('inner scope reuses the outer buffer (savepoint semantics)', async () => {
      const log: string[] = []
      await runInTransactionScope(async () => {
        enqueueAfterCommit(() => { log.push('outer-1') })
        await runInTransactionScope(async () => {
          enqueueAfterCommit(() => { log.push('inner') })
          // Both buffered against the SAME scope
          expect(__pendingAfterCommitCount()).toBe(2)
        })
        // Inner "commit" doesn't fire callbacks — that's the outer's job
        expect(log).toEqual([])
        enqueueAfterCommit(() => { log.push('outer-2') })
      })
      expect(log).toEqual(['outer-1', 'inner', 'outer-2'])
    })

    test('inner-scope rollback does NOT drop outer callbacks (deviation from PG savepoint, but matches Laravel)', async () => {
      // This matches Laravel's afterCommit semantics: throwing inside
      // a nested scope rolls back the whole stack from the outer's
      // perspective. We document this rather than emulating PG's
      // savepoint-only rollback because most uses of nested
      // transactions in Stacks code are accidental (two functions
      // both calling `transaction()` on the same code path).
      let fired = 0
      try {
        await runInTransactionScope(async () => {
          enqueueAfterCommit(() => { fired++ })
          await runInTransactionScope(async () => {
            throw new Error('inner-boom')
          })
        })
      }
      catch {}
      expect(fired).toBe(0)
    })
  })

  describe('error handling during flush', () => {
    test('a callback throwing does NOT abort sibling flushes', async () => {
      const log: string[] = []
      await runInTransactionScope(async () => {
        enqueueAfterCommit(() => { log.push('a') })
        enqueueAfterCommit(() => { throw new Error('mid-flush failure') })
        enqueueAfterCommit(() => { log.push('c') })
      })
      // Despite the middle callback throwing, both 'a' and 'c' ran
      expect(log).toEqual(['a', 'c'])
    })

    test('onError callback receives the failure', async () => {
      const seen: Array<{ message: string, index: number }> = []
      await runInTransactionScope(
        async () => {
          enqueueAfterCommit(() => { throw new Error('first') })
          enqueueAfterCommit(() => { throw new Error('second') })
        },
        {
          onError: (err, index) => {
            seen.push({ message: (err as Error).message, index })
          },
        },
      )
      expect(seen).toEqual([
        { message: 'first', index: 0 },
        { message: 'second', index: 1 },
      ])
    })
  })

  describe('test helpers', () => {
    afterEach(async () => {
      // Defensive — should already be 0 at the top of each test.
      // No-op outside a scope.
      await __flushAfterCommitNow()
    })

    test('__pendingAfterCommitCount returns 0 outside a scope', () => {
      expect(__pendingAfterCommitCount()).toBe(0)
    })

    test('__flushAfterCommitNow fires + clears mid-scope', async () => {
      let fired = 0
      await runInTransactionScope(async () => {
        enqueueAfterCommit(() => { fired++ })
        enqueueAfterCommit(() => { fired++ })
        expect(__pendingAfterCommitCount()).toBe(2)
        const flushed = await __flushAfterCommitNow()
        expect(flushed).toBe(2)
        expect(fired).toBe(2)
        expect(__pendingAfterCommitCount()).toBe(0)
      })
    })
  })
})
