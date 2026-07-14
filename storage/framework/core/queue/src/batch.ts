/**
 * Job Batch System
 *
 * Allows grouping multiple jobs into a batch with lifecycle callbacks,
 * progress tracking, cancellation support, and failure tolerance.
 *
 * Inspired by Laravel's Bus::batch() API.
 *
 * @example
 * ```typescript
 * import { Batch } from '@stacksjs/queue'
 *
 * const batch = await Batch.create([
 *   new Job({ name: 'ProcessPodcast', handle: async (data) => { ... } }),
 *   new Job({ name: 'OptimizePodcast', handle: async (data) => { ... } }),
 * ])
 *   .name('Process Podcasts')
 *   .allowFailures()
 *   .onQueue('podcasts')
 *   .then(async (_batch) => {
 *     console.log('All jobs completed!')
 *   })
 *   .catch(async (_batch, error) => {
 *     console.log('A job failed:', error)
 *   })
 *   .finally(async (_batch) => {
 *     console.log('Batch finished')
 *   })
 *   .dispatch()
 * ```
 */

/// <reference path="./shims.d.ts" />
import { log } from '@stacksjs/logging'
import { env as envVars } from '@stacksjs/env'
import type { Job } from './action'
import { updatedRowCount } from './utils'

function getQueueDriver(): string {
  return envVars.QUEUE_DRIVER || 'sync'
}

/**
 * Batch status
 */
export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/**
 * A pending job within a batch (job + optional payload)
 */
export interface BatchableJob {
  job: Job
  payload?: any
}

/**
 * Persistent batch handler shape (stacksjs/stacks#1883).
 *
 * Survives worker restart by being JSON-serialized into the
 * `job_batches.then_handler` / `catch_handler` / `finally_handler`
 * columns. The winning worker (the one that flips
 * `pending_jobs = 0 → finished_at`) reads + dispatches these on
 * completion, so a batch that finishes after the dispatching
 * process died still fires its terminal callbacks.
 *
 * Two shapes:
 *   - `job`    — dispatch a queued job by name; the worker fires
 *                the job through `Jobs.dispatch(name, payload)`
 *   - `module` — load a module and invoke a named export; payload
 *                is passed through. Useful for in-process side-
 *                effects that don't warrant their own job (e.g.
 *                cleanup helpers, simple notifications).
 *
 * Inline function callbacks (the existing `.then(fn)` API) stay
 * supported as a process-local convenience — they continue to live
 * in the in-memory registry alongside any persistent handler. The
 * winning worker fires both: any in-memory callbacks AND the
 * persistent handler if one was registered.
 */
export type PersistentBatchHandler =
  | { kind: 'job', name: string, payload?: unknown }
  | { kind: 'module', module: string, export: string, payload?: unknown }

/**
 * Batch record stored in the database
 */
export interface BatchRecord {
  id: string
  name: string
  total_jobs: number
  pending_jobs: number
  failed_jobs: number
  failed_job_ids: string
  options: string
  cancelled_at: string | null
  created_at: string
  finished_at: string | null
  /**
   * JSON-serialized {@link PersistentBatchHandler} or null.
   * Optional in the type because the columns are added by the
   * `job_batches` migration after #1883 landed — older deployments
   * may have batch rows without these columns. Reads tolerate
   * absence (treated as `null`).
   */
  then_handler?: string | null
  catch_handler?: string | null
  finally_handler?: string | null
}

/**
 * Batch options for callbacks and behavior
 */
export interface BatchOptions {
  name?: string
  queue?: string
  allowFailures?: boolean
  thenCallbacks: Array<(batch: PendingBatch | DispatchedBatch) => Promise<void> | void>
  catchCallbacks: Array<(batch: PendingBatch | DispatchedBatch, error: Error) => Promise<void> | void>
  finallyCallbacks: Array<(batch: PendingBatch | DispatchedBatch) => Promise<void> | void>
  progressCallbacks: Array<(batch: PendingBatch | DispatchedBatch) => Promise<void> | void>
  /**
   * Persistent terminal handlers (stacksjs/stacks#1883). Survives
   * worker restart by being JSON-serialized into the batch row.
   * Each slot holds at most one handler — callers needing multiple
   * actions should fan out from a single job.
   */
  thenHandler?: PersistentBatchHandler
  catchHandler?: PersistentBatchHandler
  finallyHandler?: PersistentBatchHandler
}

/**
 * PendingBatch - a batch that has been configured but not yet dispatched
 */
export class PendingBatch {
  private jobs: BatchableJob[]
  private options: BatchOptions = {
    thenCallbacks: [],
    catchCallbacks: [],
    finallyCallbacks: [],
    progressCallbacks: [],
  }

  constructor(jobs: Array<Job | BatchableJob>) {
    this.jobs = jobs.map(j => 'job' in j ? j : { job: j })
  }

  /**
   * Set a name for the batch
   */
  name(name: string): this {
    this.options.name = name
    return this
  }

  /**
   * Set the queue for all jobs in the batch
   */
  onQueue(queue: string): this {
    this.options.queue = queue
    return this
  }

  /**
   * Allow the batch to continue processing even when a job fails
   */
  allowFailures(): this {
    this.options.allowFailures = true
    return this
  }

  /**
   * Register a callback to run when all jobs in the batch complete successfully
   */
  then(callback: (batch: PendingBatch | DispatchedBatch) => Promise<void> | void): this {
    this.options.thenCallbacks.push(callback)
    return this
  }

  /**
   * Register a callback to run when a job in the batch fails
   */
  catch(callback: (batch: PendingBatch | DispatchedBatch, error: Error) => Promise<void> | void): this {
    this.options.catchCallbacks.push(callback)
    return this
  }

  /**
   * Register a callback to run when the batch finishes (regardless of success/failure)
   */
  finally(callback: (batch: PendingBatch | DispatchedBatch) => Promise<void> | void): this {
    this.options.finallyCallbacks.push(callback)
    return this
  }

  /**
   * Register a callback to run on each job completion (for progress tracking)
   */
  progress(callback: (batch: PendingBatch | DispatchedBatch) => Promise<void> | void): this {
    this.options.progressCallbacks.push(callback)
    return this
  }

  /**
   * Register a PERSISTENT then-handler that survives worker restart
   * (stacksjs/stacks#1883). The handler is serialized into the
   * `job_batches` row so the winning worker can dispatch/invoke it
   * even if the dispatching process is gone.
   *
   * Pass `{ kind: 'job', name, payload? }` to dispatch a queued
   * job, or `{ kind: 'module', module, export, payload? }` to
   * invoke a named export from a module file.
   *
   * Inline `.then(fn)` callbacks continue to work as a process-
   * local convenience — the framework fires both when present.
   *
   * @example
   * ```ts
   * // Queue job — survives worker restart
   * batch.thenHandler({ kind: 'job', name: 'NotifyComplete', payload: { reportId } })
   *
   * // Module export
   * batch.thenHandler({ kind: 'module', module: './handlers', export: 'onBatchDone' })
   * ```
   */
  thenHandler(handler: PersistentBatchHandler): this {
    this.options.thenHandler = handler
    return this
  }

  /**
   * Persistent catch-handler. Fires when any job in the batch
   * fails (unless `allowFailures` is set). See {@link thenHandler}
   * for shape.
   */
  catchHandler(handler: PersistentBatchHandler): this {
    this.options.catchHandler = handler
    return this
  }

  /**
   * Persistent finally-handler. Fires regardless of success or
   * failure on batch completion / cancellation. See
   * {@link thenHandler} for shape.
   */
  finallyHandler(handler: PersistentBatchHandler): this {
    this.options.finallyHandler = handler
    return this
  }

  /**
   * Dispatch the batch - creates a batch record and dispatches all jobs
   */
  async dispatch(): Promise<DispatchedBatch> {
    const batchId = crypto.randomUUID()
    const totalJobs = this.jobs.length

    if (totalJobs === 0) {
      throw new Error('Cannot dispatch an empty batch')
    }

    const driver = getQueueDriver()

    // Store batch record. Persistent handlers are JSON-serialized
    // into dedicated columns so the worker can fire them after a
    // restart (stacksjs/stacks#1883). Inline callbacks stay in the
    // in-memory registry for process-local convenience — both
    // mechanisms fire on completion.
    await storeBatchRecord({
      id: batchId,
      name: this.options.name || '',
      total_jobs: totalJobs,
      pending_jobs: totalJobs,
      failed_jobs: 0,
      failed_job_ids: '[]',
      options: JSON.stringify({
        queue: this.options.queue,
        allowFailures: this.options.allowFailures || false,
      }),
      cancelled_at: null,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      finished_at: null,
      then_handler: this.options.thenHandler ? JSON.stringify(this.options.thenHandler) : null,
      catch_handler: this.options.catchHandler ? JSON.stringify(this.options.catchHandler) : null,
      finally_handler: this.options.finallyHandler ? JSON.stringify(this.options.finallyHandler) : null,
    })

    // Register batch callbacks in memory
    registerBatchCallbacks(batchId, this.options)

    // Emit batch:added event
    try {
      const { emitQueueEvent } = await import('./events')
      await emitQueueEvent('batch:added', {
        jobId: batchId,
        data: { name: this.options.name, totalJobs },
      })
    }
    catch {
      // Events are optional
    }

    // Dispatch all jobs with batch metadata
    for (let i = 0; i < this.jobs.length; i++) {
      const entry = this.jobs[i]
      if (!entry) continue
      const { job, payload } = entry
      const jobPayload = {
        ...payload,
        _batchId: batchId,
        _batchIndex: i,
      }

      // Override queue if set on batch
      if (this.options.queue && !job.queue) {
        job.queue = this.options.queue
      }

      if (driver === 'sync') {
        // For sync driver, execute immediately and track
        try {
          await job.dispatchNow(jobPayload)
          await recordBatchJobCompletion(batchId)
        }
        catch (error) {
          await recordBatchJobFailure(batchId, `${batchId}:${i}`, error as Error)
        }
      }
      else {
        await job.dispatch(jobPayload)
      }
    }

    log.info(`[Batch] Dispatched batch "${this.options.name || batchId}" with ${totalJobs} jobs`)

    return new DispatchedBatch(batchId)
  }

  /**
   * Get the jobs in this pending batch
   */
  getJobs(): BatchableJob[] {
    return [...this.jobs]
  }

  /**
   * Get the batch options
   */
  getOptions(): BatchOptions {
    return this.options
  }
}

/**
 * DispatchedBatch - a batch that has been dispatched and can be inspected
 */
export class DispatchedBatch {
  readonly id: string

  constructor(id: string) {
    this.id = id
  }

  /**
   * Get the batch record from storage
   */
  async fresh(): Promise<BatchRecord | null> {
    return getBatchRecord(this.id)
  }

  /**
   * Get the batch name
   */
  async getName(): Promise<string> {
    const record = await this.fresh()
    return record?.name || ''
  }

  /**
   * Get total job count
   */
  async totalJobs(): Promise<number> {
    const record = await this.fresh()
    return record?.total_jobs || 0
  }

  /**
   * Get pending job count
   */
  async pendingJobs(): Promise<number> {
    const record = await this.fresh()
    return record?.pending_jobs || 0
  }

  /**
   * Get failed job count
   */
  async failedJobs(): Promise<number> {
    const record = await this.fresh()
    return record?.failed_jobs || 0
  }

  /**
   * Get completed job count
   */
  async completedJobs(): Promise<number> {
    const record = await this.fresh()
    if (!record) return 0
    return record.total_jobs - record.pending_jobs
  }

  /**
   * Get progress percentage (0-100)
   */
  async progress(): Promise<number> {
    const record = await this.fresh()
    if (!record || record.total_jobs === 0) return 0
    const completed = record.total_jobs - record.pending_jobs
    return Math.round((completed / record.total_jobs) * 100)
  }

  /**
   * Check if the batch has finished (all jobs completed or failed)
   */
  async finished(): Promise<boolean> {
    const record = await this.fresh()
    return record?.finished_at !== null
  }

  /**
   * Check if the batch has been cancelled
   */
  async cancelled(): Promise<boolean> {
    const record = await this.fresh()
    return record?.cancelled_at !== null
  }

  /**
   * Check if the batch has failures
   */
  async hasFailures(): Promise<boolean> {
    const record = await this.fresh()
    return (record?.failed_jobs || 0) > 0
  }

  /**
   * Get the IDs of failed jobs
   */
  async failedJobIds(): Promise<string[]> {
    const record = await this.fresh()
    if (!record) return []
    try {
      return JSON.parse(record.failed_job_ids || '[]')
    }
    catch {
      return []
    }
  }

  /**
   * Cancel the batch - prevents remaining jobs from processing
   */
  async cancel(): Promise<void> {
    const driver = getQueueDriver()

    if (driver === 'redis') {
      await cancelBatchInRedis(this.id)
    }
    else {
      await cancelBatchInDatabase(this.id)
    }

    log.info(`[Batch] Cancelled batch ${this.id}`)

    // Run finally callbacks
    const callbacks = getBatchCallbacks(this.id)
    if (callbacks) {
      for (const cb of callbacks.finallyCallbacks) {
        try {
          await cb(this)
        }
        catch (e) {
          log.error(`[Batch] Error in finally callback for batch ${this.id}:`, e)
        }
      }
    }
  }

  /**
   * Add more jobs to the batch
   */
  async add(jobs: Array<Job | BatchableJob>): Promise<void> {
    const record = await this.fresh()
    if (!record) throw new Error(`Batch ${this.id} not found`)
    if (record.cancelled_at) throw new Error(`Batch ${this.id} has been cancelled`)
    if (record.finished_at) throw new Error(`Batch ${this.id} has already finished`)

    const batchableJobs = jobs.map(j => 'job' in j ? j : { job: j })
    const newTotal = record.total_jobs + batchableJobs.length
    const newPending = record.pending_jobs + batchableJobs.length

    await updateBatchRecord(this.id, {
      total_jobs: newTotal,
      pending_jobs: newPending,
    })

    // Dispatch the new jobs
    const options = JSON.parse(record.options || '{}')
    for (let i = 0; i < batchableJobs.length; i++) {
      const entry = batchableJobs[i]
      if (!entry) continue
      const { job, payload } = entry
      const jobPayload = {
        ...payload,
        _batchId: this.id,
        _batchIndex: record.total_jobs + i,
      }

      if (options.queue && !job.queue) {
        job.queue = options.queue
      }

      await job.dispatch(jobPayload)
    }

    log.info(`[Batch] Added ${batchableJobs.length} jobs to batch ${this.id}`)
  }

  /**
   * Delete the batch record
   */
  async delete(): Promise<void> {
    await deleteBatchRecord(this.id)
    removeBatchCallbacks(this.id)
  }
}

/**
 * Create a new pending batch
 *
 * @example
 * ```typescript
 * const batch = Batch.create([job1, job2, job3])
 *   .name('My Batch')
 *   .then(async (_batch) => console.log('Done!'))
 *   .dispatch()
 * ```
 */
export class Batch {
  /**
   * Create a new pending batch from an array of jobs
   */
  static create(jobs: Array<Job | BatchableJob>): PendingBatch {
    return new PendingBatch(jobs)
  }

  /**
   * Find a dispatched batch by ID
   */
  static async find(id: string): Promise<DispatchedBatch | null> {
    const record = await getBatchRecord(id)
    if (!record) return null
    return new DispatchedBatch(id)
  }

  /**
   * Get all batches
   */
  static async all(): Promise<DispatchedBatch[]> {
    const records = await getAllBatchRecords()
    return records.map(r => new DispatchedBatch(r.id))
  }

  /**
   * Prune finished batches older than the given hours
   */
  static async prune(olderThanHours: number = 24): Promise<number> {
    return pruneBatchRecords(olderThanHours)
  }
}

// =============================================================================
// In-memory callback registry (callbacks can't be serialized to DB)
// =============================================================================

const batchCallbackRegistry = new Map<string, BatchOptions>()

function registerBatchCallbacks(batchId: string, options: BatchOptions): void {
  batchCallbackRegistry.set(batchId, options)
}

export function getBatchCallbacks(batchId: string): BatchOptions | undefined {
  return batchCallbackRegistry.get(batchId)
}

function removeBatchCallbacks(batchId: string): void {
  batchCallbackRegistry.delete(batchId)
}

// =============================================================================
// Batch record storage (database/redis)
// =============================================================================

async function storeBatchRecord(record: BatchRecord): Promise<void> {
  const driver = getQueueDriver()

  if (driver === 'redis') {
    await storeBatchInRedis(record)
  }
  else {
    await storeBatchInDatabase(record)
  }
}

async function getBatchRecord(id: string): Promise<BatchRecord | null> {
  const driver = getQueueDriver()

  if (driver === 'redis') {
    return getBatchFromRedis(id)
  }
  return getBatchFromDatabase(id)
}

async function getAllBatchRecords(): Promise<BatchRecord[]> {
  const driver = getQueueDriver()

  if (driver === 'redis') {
    return getAllBatchesFromRedis()
  }
  return getAllBatchesFromDatabase()
}

async function updateBatchRecord(id: string, updates: Partial<BatchRecord>): Promise<void> {
  const driver = getQueueDriver()

  if (driver === 'redis') {
    await updateBatchInRedis(id, updates)
  }
  else {
    await updateBatchInDatabase(id, updates)
  }
}

async function deleteBatchRecord(id: string): Promise<void> {
  const driver = getQueueDriver()

  if (driver === 'redis') {
    await deleteBatchFromRedis(id)
  }
  else {
    await deleteBatchFromDatabase(id)
  }
}

async function pruneBatchRecords(olderThanHours: number): Promise<number> {
  const driver = getQueueDriver()

  if (driver === 'redis') {
    return pruneBatchesFromRedis(olderThanHours)
  }
  return pruneBatchesFromDatabase(olderThanHours)
}

// =============================================================================
// Database storage implementation
// =============================================================================

async function storeBatchInDatabase(record: BatchRecord): Promise<void> {
  const { db } = await import('@stacksjs/database')

  await db
    .insertInto('job_batches')
    .values({
      id: record.id,
      name: record.name,
      total_jobs: record.total_jobs,
      pending_jobs: record.pending_jobs,
      failed_jobs: record.failed_jobs,
      failed_job_ids: record.failed_job_ids,
      options: record.options,
      cancelled_at: record.cancelled_at,
      created_at: record.created_at,
      finished_at: record.finished_at,
    })
    .execute()
}

async function getBatchFromDatabase(id: string): Promise<BatchRecord | null> {
  const { db } = await import('@stacksjs/database')

  const result = await (db as any)
    .selectFrom('job_batches')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return (result as BatchRecord | undefined) || null
}

async function getAllBatchesFromDatabase(): Promise<BatchRecord[]> {
  const { db } = await import('@stacksjs/database')

  const results = await (db as any)
    .selectFrom('job_batches')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute()

  return results as BatchRecord[]
}

async function updateBatchInDatabase(id: string, updates: Partial<BatchRecord>): Promise<void> {
  const { db } = await import('@stacksjs/database')

  await db
    .updateTable('job_batches')
    .set(updates as any)
    .where('id', '=', id)
    .execute()
}

async function deleteBatchFromDatabase(id: string): Promise<void> {
  const { db } = await import('@stacksjs/database')

  await db
    .deleteFrom('job_batches')
    .where('id', '=', id)
    .execute()
}

async function cancelBatchInDatabase(id: string): Promise<void> {
  await updateBatchInDatabase(id, {
    cancelled_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    finished_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  })
}

async function pruneBatchesFromDatabase(olderThanHours: number): Promise<number> {
  const { db } = await import('@stacksjs/database')
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ')

  const result = await db
    .deleteFrom('job_batches')
    .where('finished_at', 'is not', null)
    .where('finished_at', '<', cutoff)
    .executeTakeFirst()

  return Number((result as any)?.numDeletedRows ?? 0)
}

// =============================================================================
// Redis storage implementation
// =============================================================================

const REDIS_BATCH_PREFIX = 'stacks:batch:'
const REDIS_BATCH_INDEX = 'stacks:batches'

// The redis-helper functions below all read `queueConfig?.connections?.redis`
// (and sometimes its nested `.redis`) directly off the typed config. The
// previous pattern was `(queueConfig as any)?.connections?.redis?.redis`
// which escaped every type check — stacksjs/stacks#1875 T-6 swept all such
// casts so a future config-shape rename surfaces here at the type level
// instead of crashing the redis path at runtime.

async function getRedisClient(): Promise<any> {
  const { RedisQueue } = await import('./drivers/redis')
  const { queue: queueConfig } = await import('@stacksjs/config')
  const redisConfig = queueConfig?.connections?.redis
  if (!redisConfig) throw new Error('Redis queue connection is not configured')
  // Use a dedicated queue for batch management
  return new RedisQueue('__batches__', redisConfig as ConstructorParameters<typeof RedisQueue>[1])
}

async function storeBatchInRedis(record: BatchRecord): Promise<void> {
  try {
    const { createClient } = await import('redis')
    const { queue: queueConfig } = await import('@stacksjs/config')
    const redisConfig = queueConfig?.connections?.redis?.redis
    const url = redisConfig?.url || `redis://${redisConfig?.host || 'localhost'}:${redisConfig?.port || 6379}`

    const client = createClient({ url })
    await client.connect()

    const key = `${REDIS_BATCH_PREFIX}${record.id}`
    await client.hSet(key, {
      id: record.id,
      name: record.name,
      total_jobs: String(record.total_jobs),
      pending_jobs: String(record.pending_jobs),
      failed_jobs: String(record.failed_jobs),
      failed_job_ids: record.failed_job_ids,
      options: record.options,
      cancelled_at: record.cancelled_at || '',
      created_at: record.created_at,
      finished_at: record.finished_at || '',
    })
    await client.sAdd(REDIS_BATCH_INDEX, record.id)
    await client.quit()
  }
  catch {
    // Fallback to database if Redis unavailable
    await storeBatchInDatabase(record)
  }
}

async function getBatchFromRedis(id: string): Promise<BatchRecord | null> {
  try {
    const { createClient } = await import('redis')
    const { queue: queueConfig } = await import('@stacksjs/config')
    const redisConfig = queueConfig?.connections?.redis?.redis
    const url = redisConfig?.url || `redis://${redisConfig?.host || 'localhost'}:${redisConfig?.port || 6379}`

    const client = createClient({ url })
    await client.connect()

    const key = `${REDIS_BATCH_PREFIX}${id}`
    const data = await client.hGetAll(key)
    await client.quit()

    if (!data || !data.id) return null

    return {
      id: data.id,
      name: data.name,
      total_jobs: Number(data.total_jobs),
      pending_jobs: Number(data.pending_jobs),
      failed_jobs: Number(data.failed_jobs),
      failed_job_ids: data.failed_job_ids,
      options: data.options,
      cancelled_at: data.cancelled_at || null,
      created_at: data.created_at,
      finished_at: data.finished_at || null,
    }
  }
  catch {
    return getBatchFromDatabase(id)
  }
}

async function getAllBatchesFromRedis(): Promise<BatchRecord[]> {
  try {
    const { createClient } = await import('redis')
    const { queue: queueConfig } = await import('@stacksjs/config')
    const redisConfig = queueConfig?.connections?.redis?.redis
    const url = redisConfig?.url || `redis://${redisConfig?.host || 'localhost'}:${redisConfig?.port || 6379}`

    const client = createClient({ url })
    await client.connect()

    const ids = await client.sMembers(REDIS_BATCH_INDEX)
    const batches: BatchRecord[] = []

    for (const id of ids) {
      const key = `${REDIS_BATCH_PREFIX}${id}`
      const data = await client.hGetAll(key)
      if (data?.id) {
        batches.push({
          id: data.id,
          name: data.name,
          total_jobs: Number(data.total_jobs),
          pending_jobs: Number(data.pending_jobs),
          failed_jobs: Number(data.failed_jobs),
          failed_job_ids: data.failed_job_ids,
          options: data.options,
          cancelled_at: data.cancelled_at || null,
          created_at: data.created_at,
          finished_at: data.finished_at || null,
        })
      }
    }

    await client.quit()
    return batches
  }
  catch {
    return getAllBatchesFromDatabase()
  }
}

async function updateBatchInRedis(id: string, updates: Partial<BatchRecord>): Promise<void> {
  try {
    const { createClient } = await import('redis')
    const { queue: queueConfig } = await import('@stacksjs/config')
    const redisConfig = queueConfig?.connections?.redis?.redis
    const url = redisConfig?.url || `redis://${redisConfig?.host || 'localhost'}:${redisConfig?.port || 6379}`

    const client = createClient({ url })
    await client.connect()

    const key = `${REDIS_BATCH_PREFIX}${id}`
    const hashUpdates: Record<string, string> = {}

    for (const [k, v] of Object.entries(updates)) {
      hashUpdates[k] = v === null ? '' : String(v)
    }

    await client.hSet(key, hashUpdates)
    await client.quit()
  }
  catch {
    await updateBatchInDatabase(id, updates)
  }
}

async function deleteBatchFromRedis(id: string): Promise<void> {
  try {
    const { createClient } = await import('redis')
    const { queue: queueConfig } = await import('@stacksjs/config')
    const redisConfig = queueConfig?.connections?.redis?.redis
    const url = redisConfig?.url || `redis://${redisConfig?.host || 'localhost'}:${redisConfig?.port || 6379}`

    const client = createClient({ url })
    await client.connect()

    await client.del(`${REDIS_BATCH_PREFIX}${id}`)
    await client.sRem(REDIS_BATCH_INDEX, id)
    await client.quit()
  }
  catch {
    await deleteBatchFromDatabase(id)
  }
}

async function cancelBatchInRedis(id: string): Promise<void> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await updateBatchInRedis(id, {
    cancelled_at: now,
    finished_at: now,
  })
}

async function pruneBatchesFromRedis(olderThanHours: number): Promise<number> {
  try {
    const batches = await getAllBatchesFromRedis()
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000
    let pruned = 0

    for (const batch of batches) {
      if (batch.finished_at) {
        const finishedTime = new Date(batch.finished_at).getTime()
        if (finishedTime < cutoff) {
          await deleteBatchFromRedis(batch.id)
          pruned++
        }
      }
    }

    return pruned
  }
  catch {
    return pruneBatchesFromDatabase(olderThanHours)
  }
}

// =============================================================================
// Persistent handler firing (stacksjs/stacks#1883)
// =============================================================================

/**
 * Parse a JSON-serialized `PersistentBatchHandler` out of a batch
 * row. Tolerates malformed JSON (logs once and returns null) so a
 * legacy row with bad data doesn't crash the completion path.
 */
function parsePersistentHandler(raw: string | null | undefined): PersistentBatchHandler | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && (parsed.kind === 'job' || parsed.kind === 'module'))
      return parsed as PersistentBatchHandler
    log.warn(`[Batch] handler JSON has unknown kind '${(parsed as { kind?: unknown })?.kind}' — skipping`)
    return null
  }
  catch (err) {
    log.warn(`[Batch] failed to parse persistent handler: ${(err as Error).message}`)
    return null
  }
}

/**
 * Fire a persistent batch handler. Two shapes supported:
 *
 *   - `kind: 'job'`    — dispatches a queued job. Idempotent through
 *                        the standard queue idempotency path if the
 *                        caller also passed an idempotency key.
 *   - `kind: 'module'` — imports the named module and invokes the
 *                        named export. Synchronous-or-async function
 *                        signature `(payload, batchId): unknown`.
 *
 * Errors are caught and logged — the batch already finished, and
 * throwing here would corrupt the calling worker's view of completion.
 */
async function firePersistentHandler(
  handler: PersistentBatchHandler,
  batchId: string,
): Promise<void> {
  try {
    if (handler.kind === 'job') {
      const { Jobs } = await import('./job')
      await Jobs.dispatch(handler.name, { ...(handler.payload as object | undefined ?? {}), _batchId: batchId })
      return
    }

    // kind === 'module' — import + invoke. The user's handler signature
    // is `(payload, batchId): unknown`. We swallow the return value.
    const mod = await import(handler.module).catch((err) => {
      log.warn(`[Batch] persistent handler module not found: ${handler.module} (${(err as Error).message})`)
      return null
    })
    if (!mod) return
    const fn = (mod as Record<string, unknown>)[handler.export]
    if (typeof fn !== 'function') {
      log.warn(`[Batch] persistent handler export '${handler.export}' is not a function on ${handler.module}`)
      return
    }
    await (fn as (payload: unknown, batchId: string) => unknown)(handler.payload, batchId)
  }
  catch (err) {
    log.error(`[Batch] persistent handler threw for batch ${batchId}:`, err)
  }
}

// =============================================================================
// Batch job lifecycle hooks (called from the worker)
// =============================================================================

/**
 * Record that a job in a batch completed successfully.
 * Called by the worker after a batch job finishes.
 *
 * Uses an atomic decrement on the database so two concurrent workers
 * finishing batch jobs at the same instant don't both read pending=N
 * and both write pending=N-1 — that race used to leave the counter
 * stuck above zero and the batch's `then`/`finally` callbacks never
 * fired. Falls back to read-modify-write (with a debug log) when the
 * driver doesn't expose atomic SQL.
 */
export async function recordBatchJobCompletion(batchId: string): Promise<void> {
  const { db, sql } = await import('@stacksjs/database')

  // Step 1: atomic decrement. `GREATEST` clamps at 0 so a stray
  // double-record can't push the counter negative.
  await (db as any)
    .updateTable('job_batches')
    .set({ pending_jobs: sql`GREATEST(pending_jobs - 1, 0)` })
    .where('id', '=', batchId)
    .where('pending_jobs', '>', 0)
    .execute()

  // Step 2: conditional "complete this batch" — sets finished_at only
  // for the FIRST observer that sees pending_jobs hit zero. The
  // `finished_at IS NULL` guard means exactly one worker wins, so
  // terminal `then`/`finally` callbacks fire exactly once across the
  // pool. Previously this branch read-then-wrote in a second step
  // that re-introduced the race the atomic decrement was added to
  // fix. (stacksjs/stacks#1872 Q-7.)
  const finishedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const completeResult = await (db as any)
    .updateTable('job_batches')
    .set({ finished_at: finishedAt })
    .where('id', '=', batchId)
    .where('pending_jobs', '=', 0)
    .where('finished_at', 'is', null)
    .executeTakeFirst()
  const completed = updatedRowCount(completeResult) > 0

  // Progress callbacks fire on EVERY observed job completion. The
  // callback map is in-process; each worker fires its own copy
  // (intentional — "saw a job complete" is per-observer).
  const callbacks = getBatchCallbacks(batchId)
  const dispatched = new DispatchedBatch(batchId)

  if (callbacks) {
    for (const cb of callbacks.progressCallbacks) {
      try {
        await cb(dispatched)
      }
      catch (e) {
        log.error(`[Batch] Error in progress callback for batch ${batchId}:`, e)
      }
    }
  }

  // Terminal callbacks fire only for the worker that won step 2.
  if (completed) {
    try {
      const { emitQueueEvent } = await import('./events')
      await emitQueueEvent('batch:completed', { jobId: batchId })
    }
    catch {
      // Events are optional
    }

    // Read the fresh record once and use it for BOTH the
    // in-memory callback gating AND the persistent-handler dispatch.
    // The persistent path is independent of `callbacks` because the
    // dispatching worker may have died — the in-memory registry can
    // be empty here but the persistent handler columns still tell
    // us what to fire (stacksjs/stacks#1883).
    const freshRecord = await getBatchRecord(batchId)
    if (!freshRecord) {
      removeBatchCallbacks(batchId)
      log.info(`[Batch] Batch ${batchId} finished (record vanished)`)
      return
    }
    const opts = JSON.parse(freshRecord.options || '{}')
    const hasFailed = (freshRecord.failed_jobs || 0) > 0
    const succeeded = !hasFailed || opts.allowFailures

    if (callbacks) {
      if (succeeded) {
        for (const cb of callbacks.thenCallbacks) {
          try {
            await cb(dispatched)
          }
          catch (e) {
            log.error(`[Batch] Error in then callback for batch ${batchId}:`, e)
          }
        }
      }

      for (const cb of callbacks.finallyCallbacks) {
        try {
          await cb(dispatched)
        }
        catch (e) {
          log.error(`[Batch] Error in finally callback for batch ${batchId}:`, e)
        }
      }

      // Clean up in-memory callbacks
      removeBatchCallbacks(batchId)
    }

    // Persistent handlers (stacksjs/stacks#1883). Fired AFTER any
    // in-memory callbacks so both mechanisms run for batches that
    // registered both. Independent of `callbacks` — survives a
    // worker restart between dispatch and completion.
    if (succeeded) {
      const thenHandler = parsePersistentHandler(freshRecord.then_handler)
      if (thenHandler) await firePersistentHandler(thenHandler, batchId)
    }
    else {
      const catchHandler = parsePersistentHandler(freshRecord.catch_handler)
      if (catchHandler) await firePersistentHandler(catchHandler, batchId)
    }
    const finallyHandler = parsePersistentHandler(freshRecord.finally_handler)
    if (finallyHandler) await firePersistentHandler(finallyHandler, batchId)

    log.info(`[Batch] Batch ${batchId} finished`)
  }
}

/**
 * Record that a job in a batch failed.
 * Called by the worker when a batch job fails its final attempt.
 */
export async function recordBatchJobFailure(batchId: string, jobId: string, error: Error): Promise<void> {
  const { db, sql } = await import('@stacksjs/database')

  const record = await getBatchRecord(batchId)
  if (!record) return
  const opts = JSON.parse(record.options || '{}')

  // Step 1: atomic decrement pending + increment failed. This path used to
  // read pending_jobs and write back an ABSOLUTE value, which clobbered a
  // concurrent completion's atomic decrement (lost update → the batch could
  // strand with pending_jobs > 0 and never finalize, so terminal callbacks
  // never fired). Mirror the atomic completion path (#1872 Q-7).
  // (stacksjs/stacks#1957)
  await (db as any)
    .updateTable('job_batches')
    .set({
      pending_jobs: sql`GREATEST(pending_jobs - 1, 0)`,
      failed_jobs: sql`failed_jobs + 1`,
    })
    .where('id', '=', batchId)
    .where('pending_jobs', '>', 0)
    .execute()

  // Best-effort append of the failed job id (diagnostic JSON list). This read-
  // modify-write can lose an id under heavy concurrency, but the correctness-
  // critical counters above are atomic and the id list is only for triage, so
  // we accept the minor race rather than a schema change.
  try {
    const fresh = await getBatchRecord(batchId)
    if (fresh) {
      let failedIds: string[] = []
      try {
        failedIds = JSON.parse(fresh.failed_job_ids || '[]')
      }
      catch {
        failedIds = []
      }
      failedIds.push(jobId)
      await updateBatchRecord(batchId, { failed_job_ids: JSON.stringify(failedIds) })
    }
  }
  catch {
    // diagnostic-only field
  }

  const dispatched = new DispatchedBatch(batchId)
  const callbacks = getBatchCallbacks(batchId)

  // Per-failure `catch` callbacks fire on every observed failure (analogous to
  // the completion path's per-observe progress callbacks).
  if (callbacks) {
    for (const cb of callbacks.catchCallbacks) {
      try {
        await cb(dispatched, error)
      }
      catch (e) {
        log.error(`[Batch] Error in catch callback for batch ${batchId}:`, e)
      }
    }
  }

  try {
    const { emitQueueEvent } = await import('./events')
    await emitQueueEvent('batch:failed', { jobId: batchId, error })
  }
  catch {
    // Events are optional
  }

  // Step 2: atomic finalize — the `finished_at IS NULL` guard means exactly
  // one worker wins, so terminal callbacks fire exactly once.
  //  - allowFailures=false: cancel on the FIRST failure (no pending guard).
  //  - allowFailures=true : finish only when pending hits 0, sharing the same
  //    guard as the completion path so completion-or-failure (whichever sees
  //    0 first) finalizes exactly once.
  const finishedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
  let finalize = (db as any)
    .updateTable('job_batches')
    .set(opts.allowFailures
      ? { finished_at: finishedAt }
      : { finished_at: finishedAt, cancelled_at: finishedAt })
    .where('id', '=', batchId)
    .where('finished_at', 'is', null)
  if (opts.allowFailures)
    finalize = finalize.where('pending_jobs', '=', 0)
  const finalizeResult = await finalize.executeTakeFirst()
  if (updatedRowCount(finalizeResult) === 0)
    return

  // Terminal winner: fire terminal in-memory callbacks + persistent handlers,
  // mirroring recordBatchJobCompletion. This also closes the gap where a
  // failure-terminated batch never fired its persistent (#1883) handlers.
  // `succeeded` is always false-by-failure unless failures are allowed.
  const succeeded = !!opts.allowFailures
  if (callbacks) {
    if (succeeded) {
      for (const cb of callbacks.thenCallbacks) {
        try {
          await cb(dispatched)
        }
        catch (e) {
          log.error(`[Batch] Error in then callback for batch ${batchId}:`, e)
        }
      }
    }
    for (const cb of callbacks.finallyCallbacks) {
      try {
        await cb(dispatched)
      }
      catch (e) {
        log.error(`[Batch] Error in finally callback for batch ${batchId}:`, e)
      }
    }
    removeBatchCallbacks(batchId)
  }

  const freshRecord = await getBatchRecord(batchId)
  if (freshRecord) {
    if (succeeded) {
      const thenHandler = parsePersistentHandler(freshRecord.then_handler)
      if (thenHandler) await firePersistentHandler(thenHandler, batchId)
    }
    else {
      const catchHandler = parsePersistentHandler(freshRecord.catch_handler)
      if (catchHandler) await firePersistentHandler(catchHandler, batchId)
    }
    const finallyHandler = parsePersistentHandler(freshRecord.finally_handler)
    if (finallyHandler) await firePersistentHandler(finallyHandler, batchId)
  }

  log.info(`[Batch] Batch ${batchId} finished with failure(s)`)
}

/**
 * Check if a batch has been cancelled (used by worker to skip jobs)
 */
export async function isBatchCancelled(batchId: string): Promise<boolean> {
  const record = await getBatchRecord(batchId)
  return record?.cancelled_at !== null
}
