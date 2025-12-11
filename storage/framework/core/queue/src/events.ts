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
export type QueueEventHandler = (payload: QueueEventPayload) => void | Promise<void>

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
  handler: QueueEventHandler | ((event: QueueEventType, payload: QueueEventPayload) => void | Promise<void>),
): () => void {
  const events = getQueueEvents()

  if (event === '*') {
    return events.onAny(handler as (event: QueueEventType, payload: QueueEventPayload) => void | Promise<void>)
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
  private durations: number[] = []
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
        this.jobCounts.processing--
        if (payload.duration) {
          this.durations.push(payload.duration)
          // Keep only last 1000 durations
          if (this.durations.length > 1000) {
            this.durations.shift()
          }
        }
      }),
      events.on('job:failed', (payload) => {
        this.jobCounts.failed++
        this.jobCounts.processing--
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
   * Get current metrics
   */
  getMetrics(): {
    counts: typeof this.jobCounts
    averageDuration: number
    recentErrors: typeof this.errors
    throughput: number
  } {
    const averageDuration = this.durations.length > 0
      ? this.durations.reduce((a, b) => a + b, 0) / this.durations.length
      : 0

    // Calculate throughput (jobs per second over last minute)
    const oneMinuteAgo = Date.now() - 60000
    const recentCompleted = this.durations.filter((_, i) => {
      // This is a rough approximation
      return i >= this.durations.length - 60
    }).length

    return {
      counts: { ...this.jobCounts },
      averageDuration,
      recentErrors: [...this.errors],
      throughput: recentCompleted / 60,
    }
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.jobCounts = { added: 0, completed: 0, failed: 0, processing: 0 }
    this.durations = []
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
