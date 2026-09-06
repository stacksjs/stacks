// Read routing through the real `db` facade.
//
// The policy functions in `./replicas` are unit-tested on their own, but the
// wiring between them and the `db` facade is where this can silently stop
// working: the facade has to expose `db.read`, mark writes, and consult the
// router for reads. A policy that is correct but never consulted looks
// exactly like a working feature until a stale read reaches production.
//
// These run against the default sqlite connection, which declares no
// replicas — so every routed read must fall back to the primary. That is
// the property worth pinning hardest, because it is what every existing
// app relies on: adding this feature must not change behavior for anyone
// who has not configured a replica.

import { describe, expect, test } from 'bun:test'
import { db, runInDatabaseRoutingContext, withDatabaseRoutingContext } from '../src/utils'
import {
  contextHasWritten,
  contextInTransaction,
  markContextWrote,
  withRoutingContext,
  withTransactionContext,
} from '../src/replicas'

describe('db.read exists and falls back to the primary', () => {
  test('common facade properties bypass the dynamic fallback', () => {
    expect(Object.hasOwn(db, 'selectFrom')).toBe(true)
    expect(Object.hasOwn(db, 'read')).toBe(true)
    expect(Object.hasOwn(db, 'fn')).toBe(true)
    expect(Object.hasOwn(db, 'unsafe')).toBe(true)
    expect(Object.hasOwn(db, 'insertInto')).toBe(true)
    expect(Object.hasOwn(db, 'updateTable')).toBe(true)
    expect(Object.hasOwn(db, 'deleteFrom')).toBe(true)
    expect(typeof db.unsafe).toBe('function')
  })

  test('db.read exposes the builder surface', () => {
    expect(db.read).toBeDefined()
    expect(typeof db.read.selectFrom).toBe('function')
    expect(Object.hasOwn(db.read, 'selectFrom')).toBe(true)
    expect(Object.hasOwn(db.read, 'unsafe')).toBe(true)
  })

  test('with no replicas configured, db.read still executes against the primary', async () => {
    // The fallback that makes this safe to ship: an app with no replicas
    // must behave exactly as before.
    const rows = await db.read.unsafe('SELECT 1 AS one').execute()
    expect(rows).toBeDefined()
  })

  test('the primary still works normally', async () => {
    const rows = await db.unsafe('SELECT 1 AS one').execute()
    expect(rows).toBeDefined()
  })

  test('db.fn is still exposed beside `read`', () => {
    expect(db.fn).toBeDefined()
  })
})

describe('writes mark the routing context through the proxy', () => {
  // This is the wiring the policy tests cannot see. Each entry point below
  // is intercepted by name in the proxy, so a rename upstream would silently
  // stop marking writes and reintroduce the stale-read bug.
  const writeEntryPoints = [
    ['insertInto', () => db.insertInto('t')],
    ['updateTable', () => db.updateTable('t')],
    ['deleteFrom', () => db.deleteFrom('t')],
  ] as const

  for (const [name, invoke] of writeEntryPoints) {
    test(`${name} marks the context as having written`, () => {
      withRoutingContext(() => {
        expect(contextHasWritten()).toBe(false)
        // Building the statement is enough — the flag has to be set before
        // dispatch so a read issued while the write is still in flight also
        // stays on the primary.
        invoke()
        expect(contextHasWritten()).toBe(true)
      })
    })
  }

  test('reads do not mark the context', () => {
    withRoutingContext(() => {
      db.selectFrom('t')
      expect(contextHasWritten()).toBe(false)
    })
  })

  test('a write in one request context does not leak into another', async () => {
    // Without per-context isolation the first write in a busy process would
    // pin every subsequent read in every request onto the primary.
    const [wrote, clean] = await Promise.all([
      withRoutingContext(async () => {
        db.insertInto('t')
        await new Promise(resolve => setTimeout(resolve, 2))
        return contextHasWritten()
      }),
      withRoutingContext(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        return contextHasWritten()
      }),
    ])
    expect(wrote).toBe(true)
    expect(clean).toBe(false)
  })
})

describe('transactions set the routing context', () => {
  test('db.transaction marks the context as in-transaction', async () => {
    // Patched onto the builder instance in getDb(). If that patch is lost,
    // a SELECT inside a transaction becomes routable and would miss the
    // transaction's own uncommitted writes.
    await withRoutingContext(async () => {
      expect(contextInTransaction()).toBe(false)
      await db.transaction(async () => {
        expect(contextInTransaction()).toBe(true)
      })
      expect(contextInTransaction()).toBe(false)
    })
  })

  test('db.read inside a transaction falls back to the primary', async () => {
    // Asking for db.read explicitly still must not escape the transaction.
    await withRoutingContext(async () => {
      await withTransactionContext(async () => {
        const rows = await db.read.unsafe('SELECT 1 AS one').execute()
        expect(rows).toBeDefined()
      })
    })
  })
})

describe('no routing context established', () => {
  test('the request runner skips routing state when no replicas exist', () => {
    const result = withDatabaseRoutingContext(() => {
      markContextWrote()
      return contextHasWritten()
    })
    expect(result).toBe(false)
  })

  test('the argument dispatcher skips routing state when no replicas exist', () => {
    const result = runInDatabaseRoutingContext((value: number) => {
      markContextWrote()
      return { value, wrote: contextHasWritten() }
    }, 42)
    expect(result).toEqual({ value: 42, wrote: false })
  })

  test('the proxy still works outside any request boundary', async () => {
    // Background jobs and one-shot scripts have no request context. They
    // must keep working; marking a write is simply a no-op there.
    expect(() => db.insertInto('t')).not.toThrow()
    const rows = await db.unsafe('SELECT 1 AS one').execute()
    expect(rows).toBeDefined()
  })
})
