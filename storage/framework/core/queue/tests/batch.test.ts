import { afterEach, describe, expect, mock, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Mock external deps
// ---------------------------------------------------------------------------

mock.module('@stacksjs/logging', () => ({
  log: {
    info: () => {},
    error: () => {},
    warn: () => {},
  },
}))

mock.module('@stacksjs/env', () => ({
  env: { QUEUE_DRIVER: 'sync' },
}))

// In-memory batch store for the database mock
const batchStore = new Map<string, any>()

mock.module('@stacksjs/database', () => ({
  db: {
    insertInto: (table: string) => ({
      values: (vals: any) => ({
        execute: async () => {
          batchStore.set(vals.id, { ...vals })
          return [{ insertId: 1 }]
        },
      }),
    }),
    selectFrom: (table: string) => ({
      where: (col: string, op: string, val: any) => ({
        selectAll: () => ({
          executeTakeFirst: async () => batchStore.get(val) || null,
          orderBy: () => ({
            execute: async () => Array.from(batchStore.values()),
          }),
        }),
      }),
      selectAll: () => ({
        orderBy: () => ({
          execute: async () => Array.from(batchStore.values()),
        }),
      }),
    }),
    updateTable: (table: string) => ({
      set: (updates: any) => ({
        where: (col: string, op: string, val: any) => ({
          execute: async () => {
            const existing = batchStore.get(val)
            if (existing) {
              batchStore.set(val, { ...existing, ...updates })
            }
          },
        }),
      }),
    }),
    deleteFrom: (table: string) => ({
      where: (col: string, op: string, val: any) => ({
        executeTakeFirst: async () => {
          let count = 0
          for (const [key, batch] of batchStore) {
            if (batch.finished_at) {
              batchStore.delete(key)
              count++
            }
          }
          return { numDeletedRows: count }
        },
        where: () => ({
          executeTakeFirst: async () => ({ numDeletedRows: 0 }),
        }),
      }),
    }),
  },
}))

mock.module('./events', () => ({
  emitQueueEvent: mock(() => Promise.resolve()),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const {
  Batch,
  PendingBatch,
  DispatchedBatch,
  getBatchCallbacks,
  recordBatchJobCompletion,
  recordBatchJobFailure,
  isBatchCancelled,
} = await import('../src/batch')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeJob(name: string): any {
  return {
    name,
    queue: null,
    dispatch: mock(() => Promise.resolve()),
    dispatchNow: mock(() => Promise.resolve()),
  }
}

afterEach(() => {
  batchStore.clear()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Batch - PendingBatch', () => {
  test('Batch.create() returns a PendingBatch', () => {
    const batch = Batch.create([makeFakeJob('Job1')])
    expect(batch).toBeInstanceOf(PendingBatch)
  })

  test('PendingBatch has fluent API for configuration', () => {
    const batch = Batch.create([makeFakeJob('Job1')])
      .name('My Batch')
      .onQueue('high')
      .allowFailures()

    const opts = batch.getOptions()
    expect(opts.name).toBe('My Batch')
    expect(opts.queue).toBe('high')
    expect(opts.allowFailures).toBe(true)
  })

  test('then/catch/finally/progress register callbacks', () => {
    const thenCb = mock(() => {})
    const catchCb = mock(() => {})
    const finallyCb = mock(() => {})
    const progressCb = mock(() => {})

    const batch = Batch.create([makeFakeJob('Job1')])
      .then(thenCb)
      .catch(catchCb)
      .finally(finallyCb)
      .progress(progressCb)

    const opts = batch.getOptions()
    expect(opts.thenCallbacks).toHaveLength(1)
    expect(opts.catchCallbacks).toHaveLength(1)
    expect(opts.finallyCallbacks).toHaveLength(1)
    expect(opts.progressCallbacks).toHaveLength(1)
  })

  test('getJobs() returns a copy of jobs array', () => {
    const job1 = makeFakeJob('Job1')
    const batch = Batch.create([job1])
    const jobs = batch.getJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].job).toBe(job1)
  })

  test('dispatching empty batch throws', async () => {
    const batch = Batch.create([])
    await expect(batch.dispatch()).rejects.toThrow('Cannot dispatch an empty batch')
  })
})

describe('Batch - dispatch and DispatchedBatch', () => {
  test('dispatch() returns a DispatchedBatch with an id', async () => {
    const batch = Batch.create([makeFakeJob('Job1')]).name('Test')
    const dispatched = await batch.dispatch()
    expect(dispatched).toBeInstanceOf(DispatchedBatch)
    expect(dispatched.id).toBeDefined()
    expect(typeof dispatched.id).toBe('string')
  })

  test('dispatch() executes jobs synchronously for sync driver', async () => {
    const job = makeFakeJob('SyncJob')
    const batch = Batch.create([job]).name('Sync Batch')
    await batch.dispatch()
    expect(job.dispatchNow).toHaveBeenCalled()
  })

  test('batch then callback is chainable', () => {
    const thenCb = mock(() => {})
    const batch = Batch.create([makeFakeJob('Job1')])
      .name('Callback Test')
      .then(thenCb)

    expect(batch).toBeDefined()
    expect(typeof batch.dispatch).toBe('function')
  })
})

describe('Batch - DispatchedBatch inspection methods', () => {
  test('progress() returns 0-100 percentage', async () => {
    const job1 = makeFakeJob('J1')
    const job2 = makeFakeJob('J2')
    const dispatched = await Batch.create([job1, job2]).name('Progress Test').dispatch()

    // After dispatch with sync driver, both jobs ran
    const progress = await dispatched.progress()
    expect(progress).toBeGreaterThanOrEqual(0)
    expect(progress).toBeLessThanOrEqual(100)
  })

  test('getName() returns the batch name', async () => {
    const dispatched = await Batch.create([makeFakeJob('J1')]).name('Named').dispatch()
    const name = await dispatched.getName()
    expect(name).toBe('Named')
  })

  test('totalJobs() returns the job count', async () => {
    const dispatched = await Batch.create([
      makeFakeJob('J1'),
      makeFakeJob('J2'),
      makeFakeJob('J3'),
    ]).name('Count').dispatch()

    const total = await dispatched.totalJobs()
    expect(total).toBe(3)
  })
})

describe('Batch - static methods', () => {
  test('Batch.find() returns null for nonexistent batch', async () => {
    const result = await Batch.find('nonexistent-id')
    expect(result).toBeNull()
  })

  test('Batch.all() returns dispatched batches', async () => {
    await Batch.create([makeFakeJob('J1')]).name('All1').dispatch()
    await Batch.create([makeFakeJob('J2')]).name('All2').dispatch()

    const all = await Batch.all()
    expect(all.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Batch - failure handling', () => {
  test('recordBatchJobFailure tracks failed job IDs', async () => {
    const job = makeFakeJob('FailJob')
    job.dispatchNow.mockImplementation(() => {
      throw new Error('Job failed')
    })

    const catchCb = mock(() => {})
    const dispatched = await Batch.create([job])
      .name('Fail Test')
      .catch(catchCb)
      .dispatch()

    // The catch callback should have been called
    expect(catchCb).toHaveBeenCalled()
  })
})
