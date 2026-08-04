// Read replica routing policy (`src/replicas.ts`).
//
// The three safety rules are the whole point of the module, and each one
// prevents a bug that is load-dependent and near-impossible to reproduce
// once it reaches production:
//
//   1. auto-routing is opt-in       — an app never gets stale reads by accident
//   2. never route in a transaction — a tx must see its own uncommitted writes
//   3. never route after a write    — read-your-writes within a request
//
// These tests assert the decision function directly rather than standing up
// a primary and a replica, because the decision is the part that has to be
// right; the connection plumbing around it is exercised by the integration
// suite.

import { describe, expect, test } from 'bun:test'
import type { ReplicaConfig } from '../src/driver-config'
import {
  contextHasWritten,
  contextInTransaction,
  markContextWrote,
  resetReplicaCursor,
  resolveReplicaConnection,
  selectReplica,
  shouldRouteToReplica,
  withRoutingContext,
  withTransactionContext,
} from '../src/replicas'

const REPLICAS: ReplicaConfig[] = [{ host: 'replica-a' }, { host: 'replica-b' }]
const AUTO = { autoRoute: true } as const

describe('rule 1: auto-routing is opt-in', () => {
  test('does not route when autoRoute is unset or false', () => {
    withRoutingContext(() => {
      expect(shouldRouteToReplica({ policy: {}, replicas: REPLICAS })).toBe(false)
      expect(shouldRouteToReplica({ policy: { autoRoute: false }, replicas: REPLICAS })).toBe(false)
      expect(shouldRouteToReplica({ replicas: REPLICAS })).toBe(false)
    })
  })

  test('routes once autoRoute is on and replicas exist', () => {
    withRoutingContext(() => {
      expect(shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })).toBe(true)
    })
  })

  test('never routes with no replicas declared, however eager the policy', () => {
    withRoutingContext(() => {
      expect(shouldRouteToReplica({ policy: AUTO, replicas: [] })).toBe(false)
      expect(shouldRouteToReplica({ policy: AUTO })).toBe(false)
    })
  })
})

describe('rule 2: transactions stay on the primary', () => {
  test('does not route inside a transaction', async () => {
    await withRoutingContext(async () => {
      expect(shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })).toBe(true)

      await withTransactionContext(async () => {
        expect(contextInTransaction()).toBe(true)
        expect(shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })).toBe(false)
      })

      // Restored after the transaction unwinds.
      expect(contextInTransaction()).toBe(false)
      expect(shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })).toBe(true)
    })
  })

  test('nested transactions restore the outer flag, not a bare false', async () => {
    await withRoutingContext(async () => {
      await withTransactionContext(async () => {
        await withTransactionContext(async () => {
          expect(contextInTransaction()).toBe(true)
        })
        // The inner unwind must not clear the OUTER transaction's flag —
        // that would let the rest of the outer transaction route its reads
        // to a replica, outside its own isolation.
        expect(contextInTransaction()).toBe(true)
      })
      expect(contextInTransaction()).toBe(false)
    })
  })

  test('restores the flag even when the transaction body throws', async () => {
    await withRoutingContext(async () => {
      await expect(
        withTransactionContext(async () => {
          throw new Error('rollback')
        }),
      ).rejects.toThrow('rollback')
      expect(contextInTransaction()).toBe(false)
    })
  })
})

describe('rule 3: read-your-writes', () => {
  test('a write pins later reads in the same context to the primary', () => {
    withRoutingContext(() => {
      expect(shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })).toBe(true)
      markContextWrote()
      expect(contextHasWritten()).toBe(true)
      expect(shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })).toBe(false)
    })
  })

  test('the pin follows the context across awaits', async () => {
    await withRoutingContext(async () => {
      markContextWrote()
      await Promise.resolve()
      await new Promise(resolve => setTimeout(resolve, 1))
      // If the flag were stored per-tick rather than on the context object,
      // a read after any await would wrongly become routable again.
      expect(shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })).toBe(false)
    })
  })

  test('a write in one context does not pin a sibling context', async () => {
    // The critical isolation property: without it, the first write in a busy
    // process would collapse ALL read traffic back onto the primary.
    const [a, b] = await Promise.all([
      withRoutingContext(async () => {
        markContextWrote()
        await new Promise(resolve => setTimeout(resolve, 2))
        return shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })
      }),
      withRoutingContext(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        return shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })
      }),
    ])

    expect(a).toBe(false) // wrote
    expect(b).toBe(true) // did not
  })

  test('outside any routing context, reads are routable and writes are inert', () => {
    // Background work has no request boundary; it should use db.read
    // explicitly if it wants a replica. Marking a write must not throw.
    expect(() => markContextWrote()).not.toThrow()
    expect(contextHasWritten()).toBe(false)
    expect(shouldRouteToReplica({ policy: AUTO, replicas: REPLICAS })).toBe(true)
  })
})

describe('selectReplica', () => {
  test('round-robin cycles through every replica', () => {
    resetReplicaCursor()
    const three = [{ host: 'a' }, { host: 'b' }, { host: 'c' }]
    const picked = [0, 1, 2, 3].map(() => selectReplica(three, 'round-robin')?.host)
    expect(picked).toEqual(['a', 'b', 'c', 'a'])
  })

  test('returns undefined for an empty list so callers fall back to primary', () => {
    expect(selectReplica([], 'round-robin')).toBeUndefined()
  })

  test('single-replica lists short-circuit', () => {
    expect(selectReplica([{ host: 'only' }], 'random')?.host).toBe('only')
  })

  test('weighted selection respects the weights', () => {
    const weighted = [{ host: 'small', weight: 1 }, { host: 'big', weight: 9 }]
    // Ticket 0.05 * 10 = 0.5 lands in `small`'s slice; 0.5 * 10 = 5 lands in `big`'s.
    expect(selectReplica(weighted, 'weighted', () => 0.05)?.host).toBe('small')
    expect(selectReplica(weighted, 'weighted', () => 0.5)?.host).toBe('big')
  })

  test('an unweighted member in a weighted list still counts as 1', () => {
    const mixed = [{ host: 'a' }, { host: 'b', weight: 3 }]
    expect(selectReplica(mixed, 'weighted', () => 0.1)?.host).toBe('a')
  })

  test('all-zero weights fall back to even distribution instead of nothing', () => {
    resetReplicaCursor()
    const zeroed = [{ host: 'a', weight: 0 }, { host: 'b', weight: 0 }]
    // Returning undefined here would silently send every read to the
    // primary — the opposite of what declaring replicas asked for.
    expect(selectReplica(zeroed, 'weighted', () => 0.5)?.host).toBe('a')
    expect(selectReplica(zeroed, 'weighted', () => 0.5)?.host).toBe('b')
  })

  test('random selection stays in range', () => {
    expect(selectReplica(REPLICAS, 'random', () => 0)?.host).toBe('replica-a')
    expect(selectReplica(REPLICAS, 'random', () => 0.99)?.host).toBe('replica-b')
  })
})

describe('resolveReplicaConnection', () => {
  const primary = {
    name: 'stacks',
    host: 'primary.internal',
    port: 3306,
    username: 'app',
    password: 'secret',
  }

  test('inherits everything the replica does not override', () => {
    expect(resolveReplicaConnection({ host: 'replica.internal' }, primary)).toEqual({
      database: 'stacks',
      host: 'replica.internal',
      port: 3306,
      username: 'app',
      password: 'secret',
    })
  })

  test('per-replica overrides win', () => {
    const resolved = resolveReplicaConnection(
      { host: 'replica.internal', port: 3307, username: 'reader' },
      primary,
    )
    expect(resolved.port).toBe(3307)
    expect(resolved.username).toBe('reader')
    // Not overridden, so still inherited — this is what keeps a rotated
    // password from having to be copied onto every replica entry.
    expect(resolved.password).toBe('secret')
  })

  test('accepts the sqlite-style `database` key as the primary name', () => {
    const resolved = resolveReplicaConnection({ host: 'r' }, { database: 'other', port: 5432 })
    expect(resolved.database).toBe('other')
  })
})
