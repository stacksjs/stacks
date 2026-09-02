import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

// stacksjs/stacks#2361 — `isValid()` fetched one subscription row with
// `executeTakeFirst()` and no ORDER BY, then inspected that row's status. A user
// who cancels and resubscribes has several rows for the same `type` (the webhook
// upserts on `provider_id`, and Stripe issues a new id per subscription), so the
// planner was free to hand back the cancelled one and the app told a paying
// customer they were not paying.
//
// These drive the query through a fake builder that honours the filters, so the
// old shape fails them: without the status filter the canceled-first ordering
// returns the wrong row, and row order must not matter either way.

interface Row { id: number, user_id: number, type: string, provider_status: string }

const table: { rows: Row[] } = { rows: [] }
let lastQuery: { wheres: [string, unknown][], ins: [string, unknown[]][], limit?: number } = { wheres: [], ins: [] }

function fakeDb() {
  return {
    selectFrom(_t: string) {
      lastQuery = { wheres: [], ins: [] }
      const chain: any = {
        where(col: string, _op: string, val: unknown) {
          lastQuery.wheres.push([col, val])
          return chain
        },
        whereIn(col: string, vals: unknown[]) {
          lastQuery.ins.push([col, vals])
          return chain
        },
        select(_cols: string[]) { return chain },
        selectAll() { return chain },
        limit(n: number) {
          lastQuery.limit = n
          return chain
        },
        async executeTakeFirst() {
          const matched = table.rows.filter((row) => {
            for (const [col, val] of lastQuery.wheres) {
              if ((row as any)[col] !== val)
                return false
            }
            for (const [col, vals] of lastQuery.ins) {
              if (!vals.includes((row as any)[col]))
                return false
            }
            return true
          })
          return matched[0]
        },
      }
      return chain
    },
  }
}

/*
 * Override only `db`. Replacing a module wholesale drops the rest of its
 * surface, and anything else importing it then fails to load.
 *
 * Captured with a spread and restored in `afterAll`: `mock.module` is
 * process-global and never rolled back, so without this every later file in the
 * run imported `db` as the fake and `db.unsafe` was not a function - ten
 * failures in `forms`, `sms` and friends, all of which pass on their own
 * (stacksjs/stacks#2413). The spread matters for the same reason it does in
 * `core/testing`: mocking patches the live namespace in place, so a bare
 * capture would restore the mock itself.
 */
const realDatabase = { ...await import('@stacksjs/database') }
mock.module('@stacksjs/database', () => ({ ...realDatabase, db: fakeDb() }))

afterAll(() => {
  mock.module('@stacksjs/database', () => realDatabase)
})

const { manageSubscription, ENTITLING_STATUSES, INCOMPLETE_STATUSES } = await import('../src/billable/subscription')

const user = { id: 7 } as any

beforeEach(() => {
  table.rows = []
})

describe('manageSubscription.isValid', () => {
  it('says no when the user has never subscribed', async () => {
    expect(await manageSubscription.isValid(user, 'default')).toBe(false)
  })

  it('says yes for a single active subscription', async () => {
    table.rows = [{ id: 1, user_id: 7, type: 'default', provider_status: 'active' }]
    expect(await manageSubscription.isValid(user, 'default')).toBe(true)
  })

  it('says yes during a trial', async () => {
    table.rows = [{ id: 1, user_id: 7, type: 'default', provider_status: 'trialing' }]
    expect(await manageSubscription.isValid(user, 'default')).toBe(true)
  })

  // The reported failure: cancelled row first, active row second.
  it('says yes for a resubscribed customer whose cancelled row is returned first', async () => {
    table.rows = [
      { id: 1, user_id: 7, type: 'default', provider_status: 'canceled' },
      { id: 2, user_id: 7, type: 'default', provider_status: 'active' },
    ]
    expect(await manageSubscription.isValid(user, 'default')).toBe(true)
  })

  // Undefined order means the planner may return either first, so both must hold.
  it('gives the same answer whichever row the planner returns first', async () => {
    const canceled = { id: 1, user_id: 7, type: 'default', provider_status: 'canceled' }
    const active = { id: 2, user_id: 7, type: 'default', provider_status: 'active' }

    table.rows = [canceled, active]
    const canceledFirst = await manageSubscription.isValid(user, 'default')
    table.rows = [active, canceled]
    const activeFirst = await manageSubscription.isValid(user, 'default')

    expect(canceledFirst).toBe(activeFirst)
    expect(canceledFirst).toBe(true)
  })

  it('says no when every row is cancelled', async () => {
    table.rows = [
      { id: 1, user_id: 7, type: 'default', provider_status: 'canceled' },
      { id: 2, user_id: 7, type: 'default', provider_status: 'canceled' },
    ]
    expect(await manageSubscription.isValid(user, 'default')).toBe(false)
  })

  it('does not read another type as entitlement', async () => {
    table.rows = [{ id: 1, user_id: 7, type: 'addon', provider_status: 'active' }]
    expect(await manageSubscription.isValid(user, 'default')).toBe(false)
  })

  it('does not read another user as entitlement', async () => {
    table.rows = [{ id: 1, user_id: 8, type: 'default', provider_status: 'active' }]
    expect(await manageSubscription.isValid(user, 'default')).toBe(false)
  })

  it('asks the database for the status rather than filtering in memory', async () => {
    table.rows = [{ id: 1, user_id: 7, type: 'default', provider_status: 'active' }]
    await manageSubscription.isValid(user, 'default')

    expect(lastQuery.ins).toEqual([['provider_status', [...ENTITLING_STATUSES]]])
    expect(lastQuery.limit).toBe(1)
  })
})

// Same defect, same file, not mentioned in the issue: it fetched one unordered
// row and inspected it, so a stale row could mask a genuinely incomplete one.
describe('manageSubscription.isIncomplete', () => {
  it('finds an incomplete row behind a cancelled one', async () => {
    table.rows = [
      { id: 1, user_id: 7, type: 'default', provider_status: 'canceled' },
      { id: 2, user_id: 7, type: 'default', provider_status: 'incomplete' },
    ]
    expect(await manageSubscription.isIncomplete(user, 'default')).toBe(true)
  })

  it('says no when nothing is incomplete', async () => {
    table.rows = [{ id: 1, user_id: 7, type: 'default', provider_status: 'active' }]
    expect(await manageSubscription.isIncomplete(user, 'default')).toBe(false)
  })

  it('queries the incomplete vocabulary', async () => {
    table.rows = []
    await manageSubscription.isIncomplete(user, 'default')
    expect(lastQuery.ins).toEqual([['provider_status', [...INCOMPLETE_STATUSES]]])
  })
})
