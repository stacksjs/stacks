/**
 * Queue Events Integration
 *
 * Integrates queue events with Stacks' event system, providing
 * hooks for job lifecycle events and custom event handlers.
 */

import { log } from '@stacksjs/logging'

/**
 * Queue event types
 */
export type QueueEventType =
  | 'job:added'
  | 'job:processing'
  | 'job:completed'
  | 'job:failed'
  | 'job:retrying'
  | 'job:stalled'
  | 'job:progress'
  | 'queue:paused'
  | 'queue:resumed'
  | 'queue:error'
  | 'worker:started'
  | 'worker:stopped'
  | 'batch:added'
  | 'batch:completed'
  | 'batch:failed'

/**
 * Queue event payload interface
 */
export interface QueueEventPayload {
  jobId?: string
  queueName?: string
  jobName?: string
  data?: any
  result?: any
  error?: Error
  progress?: number
  timestamp: number
  attemptsMade?: number
  duration?: number
}

/**
 * Queue event handler type
 */
export type QueueEventHandler = (_payload: QueueEventPayload) => void | Promise<void>

/**
 * Queue events emitter
 */
export class QueueEvents {
  private handlers: Map<QueueEventType, Set<QueueEventHandler>> = new Map()
  private wildcardHandlers: Set<(event: QueueEventType, payload: QueueEventPayload) => void | Promise<void>> = new Set()

  /**
   * Subscribe to a queue event
   */
  on(event: QueueEventType, handler: QueueEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler)
    }
  }

  /**
   * Subscribe to all queue events
   */
  onAny(handler: (event: QueueEventType, payload: QueueEventPayload) => void | Promise<void>): () => void {
    this.wildcardHandlers.add(handler)
    return () => {
      this.wildcardHandlers.delete(handler)
    }
  }

  /**
   * Subscribe to an event once
   */
  once(event: QueueEventType, handler: QueueEventHandler): () => void {
    const wrappedHandler: QueueEventHandler = async (payload) => {
      this.handlers.get(event)?.delete(wrappedHandler)
      await handler(payload)
    }
    return this.on(event, wrappedHandler)
  }

  /**
   * Emit a queue event
   */
  async emit(event: QueueEventType, payload: Omit<QueueEventPayload, 'timestamp'>): Promise<void> {
    const fullPayload: QueueEventPayload = {
      ...payload,
      timestamp: Date.now(),
    }

    // Log the event
    this.logEvent(event, fullPayload)

    // Call specific handlers
    const handlers = this.handlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(fullPayload)
        } catch (error) {
          log.error(`Error in queue event handler for ${event}:`, error)
        }
      }
    }

    // Call wildcard handlers
    for (const handler of this.wildcardHandlers) {
      try {
        await handler(event, fullPayload)
      } catch (error) {
        log.error(`Error in wildcard queue event handler:`, error)
      }
    }
  }

  /**
   * Log event based on type
   */
  private logEvent(event: QueueEventType, payload: QueueEventPayload): void {
    const jobInfo = payload.jobId ? `[${payload.jobId}]` : ''
    const queueInfo = payload.queueName ? `on ${payload.queueName}` : ''

    switch (event) {
      case 'job:added':
        log.debug(`Job added ${jobInfo} ${queueInfo}`)
        break
      case 'job:processing':
        log.debug(`Job processing ${jobInfo} ${queueInfo}`)
        break
      case 'job:completed':
        log.info(`Job completed ${jobInfo} ${queueInfo} in ${payload.duration}ms`)
        break
      case 'job:failed':
        log.error(`Job failed ${jobInfo} ${queueInfo}:`, payload.error)
        break
      case 'job:retrying':
        log.warn(`Job retrying ${jobInfo} ${queueInfo} (attempt ${payload.attemptsMade})`)
        break
      case 'job:stalled':
        log.warn(`Job stalled ${jobInfo} ${queueInfo}`)
        break
      case 'queue:error':
        log.error(`Queue error ${queueInfo}:`, payload.error)
        break
    }
  }

  /**
   * Remove all handlers for an event
   */
  off(event: QueueEventType): void {
    this.handlers.delete(event)
  }

  /**
   * Remove all handlers
   */
  removeAllListeners(): void {
    this.handlers.clear()
    this.wildcardHandlers.clear()
  }
}

// Global queue events instance
let globalEvents: QueueEvents | null = null

/**
 * Get the global queue events instance
 */
export function getQueueEvents(): QueueEvents {
  if (!globalEvents) {
    globalEvents = new QueueEvents()
  }
  return globalEvents
}

/**
 * Subscribe to a queue event
 *
 * @example
 * ```typescript
 * // Listen for job completions
 * onQueueEvent('job:completed', (payload) => {
 *   console.log(`Job ${payload.jobId} completed!`)
 * })
 *
 * // Listen for all events
 * onQueueEvent('*', (event, payload) => {
 *   console.log(`Event: ${event}`, payload)
 * })
 * ```
 */
export function onQueueEvent(
  event: QueueEventType | '*',
  handler: QueueEventHandler | ((_event: QueueEventType, _payload: QueueEventPayload) => void | Promise<void>),
): () => void {
  const events = getQueueEvents()

  if (event === '*') {
    return events.onAny(handler as (_event: QueueEventType, _payload: QueueEventPayload) => void | Promise<void>)
  }

  return events.on(event, handler as QueueEventHandler)
}

/**
 * Emit a queue event
 */
export function emitQueueEvent(
  event: QueueEventType,
  payload: Omit<QueueEventPayload, 'timestamp'>,
): Promise<void> {
  return getQueueEvents().emit(event, payload)
}

/**
 * Event-aware job wrapper
 *
 * Wraps a job handler to automatically emit events
 */
export function withEvents<T extends (...args: any[]) => Promise<any>>(
  queueName: string,
  handler: T,
): T {
  return (async (...args: Parameters<T>) => {
    const jobId = args[0]?.id || 'unknown'
    const startTime = Date.now()

    await emitQueueEvent('job:processing', {
      jobId,
      queueName,
      data: args[0]?.data,
    })

    try {
      const result = await handler(...args)

      await emitQueueEvent('job:completed', {
        jobId,
        queueName,
        result,
        duration: Date.now() - startTime,
      })

      return result
    } catch (error) {
      await emitQueueEvent('job:failed', {
        jobId,
        queueName,
        error: error as Error,
        duration: Date.now() - startTime,
      })

      throw error
    }
  }) as T
}

/**
 * Queue event listener decorator
 *
 * @example
 * ```typescript
 * class EmailNotifications {
 *   @OnQueueEvent('job:completed')
 *   async onJobCompleted(payload: QueueEventPayload) {
 *     console.log('Job completed:', payload)
 *   }
 * }
 * ```
 */
export function OnQueueEvent(event: QueueEventType) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value

    // Register the handler when the class is instantiated
    const events = getQueueEvents()
    events.on(event, originalMethod)

    return descriptor
  }
}

/**
 * Queue metrics based on events
 */
export class QueueMetrics {
  private jobCounts = {
    added: 0,
    completed: 0,
    failed: 0,
    processing: 0,
  }
  private completions: Array<{ timestamp: number; duration: number }> = []
  private errors: Array<{ error: Error; timestamp: number }> = []
  private unsubscribe: (() => void)[] = []

  constructor() {
    this.setupListeners()
  }

  private setupListeners(): void {
    const events = getQueueEvents()

    this.unsubscribe.push(
      events.on('job:added', () => {
        this.jobCounts.added++
      }),
      events.on('job:processing', () => {
        this.jobCounts.processing++
      }),
      events.on('job:completed', (payload) => {
        this.jobCounts.completed++
        this.jobCounts.processing = Math.max(0, this.jobCounts.processing - 1)
        const duration = payload.duration || 0
        this.completions.push({ timestamp: Date.now(), duration })
        // Keep only last 1000 completions
        if (this.completions.length > 1000) {
          this.completions.shift()
        }
      }),
      events.on('job:failed', (payload) => {
        this.jobCounts.failed++
        this.jobCounts.processing = Math.max(0, this.jobCounts.processing - 1)
        if (payload.error) {
          this.errors.push({ error: payload.error, timestamp: Date.now() })
          // Keep only last 100 errors
          if (this.errors.length > 100) {
            this.errors.shift()
          }
        }
      }),
    )
  }

  /**
   * Get throughput (completed jobs per minute) over the last minute
   */
  getThroughputPerMinute(): number {
    const oneMinuteAgo = Date.now() - 60000
    const recentCount = this.completions.filter(c => c.timestamp >= oneMinuteAgo).length
    return recentCount
  }

  /**
   * Get average processing time (ms) over the last minute
   */
  getAverageProcessingTime(): number {
    const oneMinuteAgo = Date.now() - 60000
    const recent = this.completions.filter(c => c.timestamp >= oneMinuteAgo)
    if (recent.length === 0) return 0
    return recent.reduce((sum, c) => sum + c.duration, 0) / recent.length
  }

  /**
   * Get current metrics
   */
  getMetrics(): {
    counts: { added: number; completed: number; failed: number; processing: number }
    averageDuration: number
    recentErrors: Array<{ error: Error; timestamp: number }>
    throughputPerMinute: number
  } {
    return {
      counts: { ...this.jobCounts },
      averageDuration: this.getAverageProcessingTime(),
      recentErrors: [...this.errors],
      throughputPerMinute: this.getThroughputPerMinute(),
    }
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.jobCounts = { added: 0, completed: 0, failed: 0, processing: 0 }
    this.completions = []
    this.errors = []
  }

  /**
   * Stop collecting metrics
   */
  stop(): void {
    this.unsubscribe.forEach(fn => fn())
    this.unsubscribe = []
  }
}

// Global metrics singleton
let globalMetrics: QueueMetrics | null = null

/**
 * Get or create the global QueueMetrics instance
 */
export function getGlobalMetrics(): QueueMetrics {
  if (!globalMetrics) {
    globalMetrics = new QueueMetrics()
  }
  return globalMetrics
}

/**
 * Worker status tracker
 *
 * Tracks registered workers and their activity for health checks.
 */
export interface TrackedWorker {
  id: string
  status: 'active' | 'idle' | 'stopped'
  queue: string
  processedCount: number
  failedCount: number
  lastActivityAt: string
  startedAt: string
}

class WorkerTracker {
  private workers = new Map<string, TrackedWorker>()

  register(id: string, queue: string): void {
    this.workers.set(id, {
      id,
      status: 'idle',
      queue,
      processedCount: 0,
      failedCount: 0,
      lastActivityAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    })
  }

  markActive(id: string): void {
    const w = this.workers.get(id)
    if (w) {
      w.status = 'active'
      w.lastActivityAt = new Date().toISOString()
    }
  }

  markIdle(id: string): void {
    const w = this.workers.get(id)
    if (w) {
      w.status = 'idle'
      w.lastActivityAt = new Date().toISOString()
    }
  }

  recordCompletion(id: string): void {
    const w = this.workers.get(id)
    if (w) {
      w.processedCount++
      w.lastActivityAt = new Date().toISOString()
    }
  }

  recordFailure(id: string): void {
    const w = this.workers.get(id)
    if (w) {
      w.failedCount++
      w.lastActivityAt = new Date().toISOString()
    }
  }

  unregister(id: string): void {
    const w = this.workers.get(id)
    if (w) {
      w.status = 'stopped'
    }
  }

  getAll(): TrackedWorker[] {
    return Array.from(this.workers.values())
  }

  clear(): void {
    this.workers.clear()
  }
}

// Global worker tracker singleton
const workerTracker = new WorkerTracker()

export function getWorkerTracker(): WorkerTracker {
  return workerTracker
}
