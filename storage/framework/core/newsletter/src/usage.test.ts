import type { UsageQuotaSnapshot, UsageQuotaStore } from './usage'
import { describe, expect, test } from 'bun:test'
import { releaseUsage, reserveUsage, UsageQuotaError } from './usage'

function memoryStore(initial: UsageQuotaSnapshot | null): UsageQuotaStore & { current: () => UsageQuotaSnapshot | null } {
  let current = initial ? { ...initial } : null

  return {
    current: () => current ? { ...current } : null,
    async read() {
      return current ? { ...current } : null
    },
    async compareAndSet(snapshot, nextUsed) {
      await Promise.resolve()
      if (!current || current.meter !== snapshot.meter || current.used !== snapshot.used || current.limit !== snapshot.limit)
        return false
      current = { ...current, used: nextUsed }
      return true
    },
  }
}

describe('usage quota reservations', () => {
  test('reserves and releases bounded usage', async () => {
    const store = memoryStore({ meter: 'ai_generations', used: 9, limit: 10 })
    const reservation = await reserveUsage(store, 'ai_generations')

    expect(reservation).toEqual({ meter: 'ai_generations', quantity: 1, previousUsed: 9, used: 10, limit: 10 })
    expect(store.current()?.used).toBe(10)

    await releaseUsage(store, reservation)
    expect(store.current()?.used).toBe(9)
  })

  test('allows an explicitly unlimited meter', async () => {
    const store = memoryStore({ meter: 'email_sends', used: 40_000, limit: null })
    await expect(reserveUsage(store, 'email_sends', 5_000)).resolves.toMatchObject({ used: 45_000, limit: null })
  })

  test('fails closed for missing, invalid, and exhausted meters', async () => {
    await expect(reserveUsage(memoryStore(null), 'sms_segments')).rejects.toMatchObject({ code: 'unavailable' })
    await expect(reserveUsage(memoryStore({ meter: 'sms_segments', used: -1, limit: 10 }), 'sms_segments'))
      .rejects.toMatchObject({ code: 'invalid' })
    await expect(reserveUsage(memoryStore({ meter: 'sms_segments', used: 10, limit: 10 }), 'sms_segments'))
      .rejects.toMatchObject({ code: 'exceeded' })
    await expect(reserveUsage(memoryStore({ meter: 'sms_segments', used: 0, limit: 10 }), 'sms_segments', 0))
      .rejects.toBeInstanceOf(UsageQuotaError)
  })

  test('does not overbook concurrent reservations', async () => {
    const store = memoryStore({ meter: 'ai_generations', used: 0, limit: 1 })
    const outcomes = await Promise.allSettled([
      reserveUsage(store, 'ai_generations'),
      reserveUsage(store, 'ai_generations'),
    ])

    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(store.current()?.used).toBe(1)
  })

  test('reports persistent compare-and-set contention', async () => {
    const store: UsageQuotaStore = {
      read: async () => ({ meter: 'contacts', used: 0, limit: 100 }),
      compareAndSet: async () => false,
    }

    await expect(reserveUsage(store, 'contacts', 1, 2)).rejects.toMatchObject({ code: 'contention' })
  })
})
