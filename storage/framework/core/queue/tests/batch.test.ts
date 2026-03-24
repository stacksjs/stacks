import { describe, expect, mock, test } from 'bun:test'

// Import real batch classes
const {
  Batch,
  PendingBatch,
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

describe('Batch - dispatch structure', () => {
  test('dispatch is a function on PendingBatch', () => {
    const batch = Batch.create([makeFakeJob('Job1')]).name('Test')
    expect(typeof batch.dispatch).toBe('function')
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

describe('Batch - static methods', () => {
  test('Batch.create is a function', () => {
    expect(typeof Batch.create).toBe('function')
  })

  test('Batch.find is a function', () => {
    expect(typeof Batch.find).toBe('function')
  })

  test('Batch.all is a function', () => {
    expect(typeof Batch.all).toBe('function')
  })
})
