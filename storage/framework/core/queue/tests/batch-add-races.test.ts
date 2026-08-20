import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

// Regression coverage for `DispatchedBatch.add()` (stacksjs/stacks#2282).
//
// `add()` used to read the batch row, compute `total_jobs + n` /
// `pending_jobs + n` in JS, and write those ABSOLUTE values back. Two
// overlapping add() calls — or an add() overlapping a worker's atomic
// decrement — both read the same counters and the second write erased the
// first. The batch then held fewer pending jobs than it had actually
// dispatched, so `pending_jobs` could reach 0 while jobs were still running
// and the terminal then/finally callbacks fired mid-batch.
//
// `@stacksjs/database` is mocked with an in-memory row store that honours the
// difference the fix depends on: a relative SQL fragment is evaluated against
// the row AT WRITE TIME, an absolute value is not. That is exactly what makes
// the concurrent cases below pass or fail.

// Pin the driver so `incrementBatchCounters` takes the database branch rather
// than trying to reach Redis. Restored in afterAll — bun runs test files in one
// process, so leaving it set would silently pin the driver for every file that
// happens to run after this one.
const previousQueueDriver = process.env.QUEUE_DRIVER
process.env.QUEUE_DRIVER = 'sync'

const BATCH_ID = 'batch-2282'

interface BatchRow {
  [column: string]: any
}

const rows = new Map<string, BatchRow>()

/** Fired right after a SELECT snapshot is taken — simulates a concurrent writer. */
let afterRead: (() => void) | null = null

/** Releases waiting SELECTs only once `participants` of them have arrived. */
let readBarrier: { arrive: () => Promise<void> } | null = null

function makeReadBarrier(participants: number) {
  let arrived = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  return {
    async arrive(): Promise<void> {
      arrived++
      if (arrived >= participants)
        release()
      await gate
    },
  }
}

/**
 * Evaluate the relative fragments batch.ts writes. Anything else is a
 * deliberate throw: an absolute value silently "working" here is the bug.
 */
function evaluateFragment(fragment: { sql: string, parameters?: unknown[] }, row: BatchRow): number {
  const relative = /^(\w+) \+ \?$/.exec(fragment.sql)
  if (relative)
    return Number(row[relative[1] as string]) + Number(fragment.parameters?.[0])

  throw new Error(`test double cannot evaluate SQL fragment: ${fragment.sql}`)
}

/** Same shape as `@stacksjs/database`'s `sql` tag: text with `?` + bound params. */
function sql(strings: TemplateStringsArray, ...values: unknown[]): { sql: string, parameters: unknown[] } {
  let text = ''
  const parameters: unknown[] = []

  for (let i = 0; i < strings.length; i++) {
    text += strings[i]
    if (i < values.length) {
      text += '?'
      parameters.push(values[i])
    }
  }

  return { sql: text, parameters }
}

const db = {
  selectFrom(_table: string) {
    const filters: Array<[string, any]> = []
    const chain: any = {
      where(column: string, _op: string, value: any) {
        filters.push([column, value])
        return chain
      },
      selectAll: () => chain,
      async executeTakeFirst() {
        await readBarrier?.arrive()
        const row = [...rows.values()].find(r => filters.every(([c, v]) => r[c] === v))
        // Snapshot: callers must not observe later writes through this object.
        const snapshot = row ? { ...row } : undefined
        afterRead?.()
        return snapshot
      },
    }
    return chain
  },

  updateTable(_table: string) {
    let updates: Record<string, any> = {}
    const filters: Array<[string, any]> = []
    const nullGuards: string[] = []
    const chain: any = {
      set(values: Record<string, any>) {
        updates = values
        return chain
      },
      where(column: string, _op: string, value: any) {
        filters.push([column, value])
        return chain
      },
      whereNull(column: string) {
        nullGuards.push(column)
        return chain
      },
      async executeTakeFirst() {
        let numUpdatedRows = 0

        for (const row of rows.values()) {
          if (!filters.every(([c, v]) => row[c] === v))
            continue
          if (!nullGuards.every(c => row[c] === null || row[c] === undefined))
            continue

          for (const [column, value] of Object.entries(updates)) {
            row[column] = value && typeof value === 'object' && 'sql' in value
              ? evaluateFragment(value, row)
              : value
          }
          numUpdatedRows++
        }

        return { numUpdatedRows }
      },
      execute: () => chain.executeTakeFirst(),
    }
    return chain
  },
}

// `mock.module` is process-wide and `bun test` runs every file in one process,
// so the real module is captured first and put back afterwards — otherwise the
// files that load after this one import this test double instead of the real
// database package and fail on missing exports.
const realDatabase = { ...(await import('@stacksjs/database')) }

mock.module('@stacksjs/database', () => ({ db, sql }))

afterAll(() => {
  mock.module('@stacksjs/database', () => realDatabase)

  if (previousQueueDriver === undefined)
    delete process.env.QUEUE_DRIVER
  else
    process.env.QUEUE_DRIVER = previousQueueDriver
})

const { DispatchedBatch } = await import('../src/batch')

function makeFakeJob(name: string): any {
  return {
    name,
    queue: null,
    dispatch: mock(() => Promise.resolve()),
    dispatchNow: mock(() => Promise.resolve()),
  }
}

function seedBatch(overrides: Partial<BatchRow> = {}): void {
  rows.set(BATCH_ID, {
    id: BATCH_ID,
    name: 'Process Podcasts',
    total_jobs: 3,
    pending_jobs: 3,
    failed_jobs: 0,
    failed_job_ids: '[]',
    options: '{"queue":"podcasts","allowFailures":false}',
    cancelled_at: null,
    created_at: '2026-08-04 10:00:00',
    finished_at: null,
    ...overrides,
  })
}

describe('DispatchedBatch.add - atomic counter growth (#2282)', () => {
  beforeEach(() => {
    rows.clear()
    afterRead = null
    readBarrier = null
    seedBatch()
  })

  test('two overlapping add() calls both land', async () => {
    // Both calls read the batch before either writes — the read-modify-write
    // computed 4 twice and one add() vanished.
    readBarrier = makeReadBarrier(2)
    const batch = new DispatchedBatch(BATCH_ID)

    await Promise.all([
      batch.add([makeFakeJob('First')]),
      batch.add([makeFakeJob('Second')]),
    ])

    expect(rows.get(BATCH_ID)!.total_jobs).toBe(5)
    expect(rows.get(BATCH_ID)!.pending_jobs).toBe(5)
  })

  test('an add() overlapping a completion decrement does not erase it', async () => {
    // A worker finishes a job (pending 3 → 2) after add() read the row.
    afterRead = () => {
      const row = rows.get(BATCH_ID)!
      row.pending_jobs = Math.max(row.pending_jobs - 1, 0)
      afterRead = null
    }

    await new DispatchedBatch(BATCH_ID).add([makeFakeJob('Extra'), makeFakeJob('Another')])

    expect(rows.get(BATCH_ID)!.total_jobs).toBe(5)
    // 3 - 1 + 2, not the 5 an absolute write would have restored.
    expect(rows.get(BATCH_ID)!.pending_jobs).toBe(4)
  })

  test('a batch cancelled between the read and the write refuses the add', async () => {
    afterRead = () => {
      rows.get(BATCH_ID)!.cancelled_at = '2026-08-04 10:00:05'
      afterRead = null
    }

    await expect(new DispatchedBatch(BATCH_ID).add([makeFakeJob('TooLate')]))
      .rejects
      .toThrow(`Batch ${BATCH_ID} was cancelled, finished or deleted before the jobs could be added`)

    expect(rows.get(BATCH_ID)!.total_jobs).toBe(3)
    expect(rows.get(BATCH_ID)!.pending_jobs).toBe(3)
  })

  test('a batch finished between the read and the write refuses the add', async () => {
    afterRead = () => {
      rows.get(BATCH_ID)!.finished_at = '2026-08-04 10:00:05'
      afterRead = null
    }

    await expect(new DispatchedBatch(BATCH_ID).add([makeFakeJob('TooLate')]))
      .rejects
      .toThrow('before the jobs could be added')

    expect(rows.get(BATCH_ID)!.total_jobs).toBe(3)
  })

  test('the uncontended add still grows the counters and dispatches the jobs', async () => {
    const job = makeFakeJob('Extra')

    await new DispatchedBatch(BATCH_ID).add([job])

    expect(rows.get(BATCH_ID)!.total_jobs).toBe(4)
    expect(rows.get(BATCH_ID)!.pending_jobs).toBe(4)
    expect(job.dispatch).toHaveBeenCalledTimes(1)
    // The dispatch loop still reads `options` (queue override) and the batch
    // metadata off the pre-increment record.
    expect(job.queue).toBe('podcasts')
    expect(job.dispatch.mock.calls[0][0]).toEqual({ _batchId: BATCH_ID, _batchIndex: 3 })
  })

  test('adding nothing is a no-op, not a spurious "cancelled" error', async () => {
    // `+ 0` changes no column and MySQL reports 0 affected rows for a
    // no-change UPDATE, so the guard must not run at all for an empty add.
    await new DispatchedBatch(BATCH_ID).add([])

    expect(rows.get(BATCH_ID)!.total_jobs).toBe(3)
  })

  test('the pre-read precondition checks still fire first', async () => {
    rows.clear()
    await expect(new DispatchedBatch(BATCH_ID).add([makeFakeJob('Orphan')]))
      .rejects
      .toThrow(`Batch ${BATCH_ID} not found`)

    seedBatch({ cancelled_at: '2026-08-04 10:00:00' })
    await expect(new DispatchedBatch(BATCH_ID).add([makeFakeJob('Cancelled')]))
      .rejects
      .toThrow(`Batch ${BATCH_ID} has been cancelled`)

    seedBatch({ finished_at: '2026-08-04 10:00:00' })
    await expect(new DispatchedBatch(BATCH_ID).add([makeFakeJob('Finished')]))
      .rejects
      .toThrow(`Batch ${BATCH_ID} has already finished`)
  })
})
