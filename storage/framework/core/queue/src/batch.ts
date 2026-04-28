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
 *   .then(async (batch) => {
 *     console.log('All jobs completed!')
 *   })
 *   .catch(async (batch, error) => {
 *     console.log('A job failed:', error)
 *   })
 *   .finally(async (batch) => {
 *     console.log('Batch finished')
 *   })
 *   .dispatch()
 * ```
 */

import { log } from '@stacksjs/logging'
import { env as envVars } from '@stacksjs/env'
import type { Job } from './action'

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
   * Dispatch the batch - creates a batch record and dispatches all jobs
   */
  async dispatch(): Promise<DispatchedBatch> {
    const batchId = crypto.randomUUID()
    const totalJobs = this.jobs.length

    if (totalJobs === 0) {
      throw new Error('Cannot dispatch an empty batch')
    }

    const driver = getQueueDriver()

    // Store batch record
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
      const { job, payload } = this.jobs[i]
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
      const { job, payload } = batchableJobs[i]
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
 *   .then(async (batch) => console.log('Done!'))
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

  const result = await db
    .selectFrom('job_batches')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return (result as BatchRecord | undefined) || null
}

async function getAllBatchesFromDatabase(): Promise<BatchRecord[]> {
  const { db } = await import('@stacksjs/database')

  const results = await db
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

async function getRedisClient(): Promise<any> {
  const { RedisQueue } = await import('./drivers/redis')
  const { queue: queueConfig } = await import('@stacksjs/config')
  const redisConfig = (queueConfig as any)?.connections?.redis
  if (!redisConfig) throw new Error('Redis queue connection is not configured')
  // Use a dedicated queue for batch management
  return new RedisQueue('__batches__', redisConfig as any)
}

async function storeBatchInRedis(record: BatchRecord): Promise<void> {
  try {
    const { createClient } = await import('redis')
    const { queue: queueConfig } = await import('@stacksjs/config')
    const redisConfig = (queueConfig as any)?.connections?.redis?.redis
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
    const redisConfig = (queueConfig as any)?.connections?.redis?.redis
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
    const redisConfig = (queueConfig as any)?.connections?.redis?.redis
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
    const redisConfig = (queueConfig as any)?.connections?.redis?.redis
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
    const redisConfig = (queueConfig as any)?.connections?.redis?.redis
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
  // Try the atomic path first.
  try {
    const { db, sql } = await import('@stacksjs/database')
    const result: any = await (db as any)
      .updateTable('job_batches')
      .set({ pending_jobs: sql`GREATEST(pending_jobs - 1, 0)` })
      .where('id', '=', batchId)
      .where('pending_jobs', '>', 0)
      .execute()
    void result
  }
  catch (err) {
    log.debug(`[Batch] Atomic decrement unavailable, falling back to read-modify-write: ${(err as Error).message}`)
  }

  const record = await getBatchRecord(batchId)
  if (!record) return

  const newPending = Math.max(0, record.pending_jobs - 1)
  const updates: Partial<BatchRecord> = { pending_jobs: newPending }

  // Check if batch is finished
  if (newPending === 0) {
    updates.finished_at = new Date().toISOString().slice(0, 19).replace('T', ' ')
  }

  await updateBatchRecord(batchId, updates)

  // Fire progress callbacks
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

  // If batch is finished, fire then/finally callbacks
  if (newPending === 0) {
    try {
      const { emitQueueEvent } = await import('./events')
      await emitQueueEvent('batch:completed', { jobId: batchId })
    }
    catch {
      // Events are optional
    }

    if (callbacks) {
      // Only fire "then" if no failures (or allowFailures is set)
      const freshRecord = await getBatchRecord(batchId)
      if (!freshRecord) {
        removeBatchCallbacks(batchId)
        return
      }
      const opts = JSON.parse(freshRecord.options || '{}')
      const hasFailed = (freshRecord.failed_jobs || 0) > 0

      if (!hasFailed || opts.allowFailures) {
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

      // Clean up callbacks
      removeBatchCallbacks(batchId)
    }

    log.info(`[Batch] Batch ${batchId} finished`)
  }
}

/**
 * Record that a job in a batch failed.
 * Called by the worker when a batch job fails its final attempt.
 */
export async function recordBatchJobFailure(batchId: string, jobId: string, error: Error): Promise<void> {
  const record = await getBatchRecord(batchId)
  if (!record) return

  // Update failed job IDs
  let failedIds: string[] = []
  try {
    failedIds = JSON.parse(record.failed_job_ids || '[]')
  }
  catch {
    failedIds = []
  }
  failedIds.push(jobId)

  const newPending = Math.max(0, record.pending_jobs - 1)
  const newFailed = record.failed_jobs + 1

  const updates: Partial<BatchRecord> = {
    pending_jobs: newPending,
    failed_jobs: newFailed,
    failed_job_ids: JSON.stringify(failedIds),
  }

  const opts = JSON.parse(record.options || '{}')

  // If failures are not allowed, cancel the batch
  if (!opts.allowFailures) {
    updates.cancelled_at = new Date().toISOString().slice(0, 19).replace('T', ' ')
    updates.finished_at = new Date().toISOString().slice(0, 19).replace('T', ' ')
  }
  else if (newPending === 0) {
    updates.finished_at = new Date().toISOString().slice(0, 19).replace('T', ' ')
  }

  await updateBatchRecord(batchId, updates)

  // Fire catch callbacks
  const callbacks = getBatchCallbacks(batchId)
  const dispatched = new DispatchedBatch(batchId)

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
    await emitQueueEvent('batch:failed', {
      jobId: batchId,
      error,
    })
  }
  catch {
    // Events are optional
  }

  // Check if batch is now finished
  const isFinished = !opts.allowFailures || newPending === 0
  if (isFinished && callbacks) {
    for (const cb of callbacks.finallyCallbacks) {
      try {
        await cb(dispatched)
      }
      catch (e) {
        log.error(`[Batch] Error in finally callback for batch ${batchId}:`, e)
      }
    }

    // If allowFailures and all jobs done, also fire then callbacks
    if (opts.allowFailures && newPending === 0) {
      for (const cb of callbacks.thenCallbacks) {
        try {
          await cb(dispatched)
        }
        catch (e) {
          log.error(`[Batch] Error in then callback for batch ${batchId}:`, e)
        }
      }
    }

    removeBatchCallbacks(batchId)
    log.info(`[Batch] Batch ${batchId} finished with ${newFailed} failure(s)`)
  }
}

/**
 * Check if a batch has been cancelled (used by worker to skip jobs)
 */
export async function isBatchCancelled(batchId: string): Promise<boolean> {
  const record = await getBatchRecord(batchId)
  return record?.cancelled_at !== null
}
