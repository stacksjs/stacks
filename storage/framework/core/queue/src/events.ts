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
   * Unsubscribe functions produced by `subscribeListener`, keyed by the listener
   * object they belong to, so `unsubscribeListener` can tear all of them down at
   * once. The map is weak: it must never be the reason a listener stays alive.
   */
  private listenerSubscriptions: WeakMap<object, Set<() => void>> = new WeakMap()

  /**
   * Drops a listener's subscription as soon as the listener itself is collected.
   * `emit` also prunes dead subscriptions when it walks them, but that only
   * happens if an event actually fires; the registry keeps the handler set from
   * growing during quiet periods.
   */
  private readonly reclaim = new FinalizationRegistry<() => void>((unsubscribe) => {
    unsubscribe()
  })

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
   * Subscribe a method of `listener` to `event`, invoked with `this` bound to
   * `listener` — but retaining `listener` only *weakly*.
   *
   * This is what `@OnQueueEvent` uses. A plain `on(event, listener.method.bind(listener))`
   * makes the process-global emitter the permanent owner of every listener object
   * ever created: the emitter outlives everything, so nothing is ever collected and
   * `emit`'s serial await-loop gets slower for the rest of the process' life
   * (stacksjs/stacks#2282 item 7). Holding the listener weakly ties the
   * subscription's lifetime to the only lifetime this class can observe — the
   * listener's own reachability.
   *
   * The trade-off is real and is the caller's to manage: **something else must hold
   * a reference to `listener`** (a module-level binding, a container, a registry).
   * A listener that nothing references is garbage, and a collected listener stops
   * receiving events. Use `unsubscribeListener` for deterministic teardown.
   *
   * @returns an unsubscribe function; calling it more than once is a no-op.
   */
  subscribeListener(listener: object, event: QueueEventType, method: QueueEventHandler): () => void {
    // Nothing below may close over `listener` itself. The emitter holds `weakHandler`
    // strongly, so a single strong reference to `listener` anywhere in that closure
    // chain — including one reached indirectly through another captured closure —
    // silently reinstates the leak this method exists to prevent. Everything goes
    // through `ref` instead.
    const ref = new WeakRef(listener)

    const weakHandler: QueueEventHandler = (payload) => {
      const target = ref.deref()
      if (target === undefined) {
        // The listener is gone, so this subscription can never do anything again.
        removeFromHandlers()
        return
      }

      return method.call(target, payload)
    }

    const removeFromHandlers = this.on(event, weakHandler)

    const unsubscribe = (): void => {
      removeFromHandlers()

      const target = ref.deref()
      if (target === undefined)
        return

      const subscriptions = this.listenerSubscriptions.get(target)
      if (!subscriptions)
        return

      subscriptions.delete(unsubscribe)
      if (subscriptions.size === 0) {
        this.listenerSubscriptions.delete(target)
        this.reclaim.unregister(target)
      }
    }

    let owned = this.listenerSubscriptions.get(listener)
    if (!owned) {
      owned = new Set()
      this.listenerSubscriptions.set(listener, owned)
    }
    owned.add(unsubscribe)

    // Registered per subscription (a listener may decorate several methods), all
    // under the same token so `unsubscribeListener` can drop them in one call. The
    // held value must not reach the target either, or the registry would pin the very
    // object whose collection it is waiting for — `removeFromHandlers` only closes
    // over the weak handler.
    this.reclaim.register(listener, removeFromHandlers, listener)

    return unsubscribe
  }

  /**
   * Remove every subscription `subscribeListener` made for `listener`.
   *
   * This is the deterministic counterpart to collection: call it from whatever owns
   * the listener's lifecycle (`stop()`, `[Symbol.dispose]()`, a container teardown)
   * instead of waiting for the GC.
   *
   * @returns the number of subscriptions removed.
   */
  unsubscribeListener(listener: object): number {
    const owned = this.listenerSubscriptions.get(listener)
    if (!owned)
      return 0

    // `unsubscribe` mutates `owned`, so iterate a copy.
    const all = Array.from(owned)
    for (const unsubscribe of all)
      unsubscribe()

    this.listenerSubscriptions.delete(listener)
    this.reclaim.unregister(listener)

    return all.length
  }

  /**
   * Number of handlers currently registered for `event`.
   *
   * Exposed so leak regressions are observable: subscriptions belonging to
   * collected listeners are pruned by `emit`, so this count tracks live listeners
   * rather than every listener ever constructed (stacksjs/stacks#2282 item 7).
   * Pass `'*'` for the wildcard handler count.
   */
  listenerCount(event: QueueEventType | '*'): number {
    if (event === '*')
      return this.wildcardHandlers.size

    return this.handlers.get(event)?.size ?? 0
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
    // The per-listener bookkeeping now describes handlers that no longer exist, so
    // drop it too — otherwise `unsubscribeListener` reports removals it did not make.
    this.listenerSubscriptions = new WeakMap()
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
 * Subscribes the decorated **instance method** to `event` on the global queue
 * events instance once per instance, with `this` bound to that instance — creating
 * N listener objects means N subscriptions, exactly as if every constructor had
 * called `onQueueEvent(event, this.method.bind(this))` by hand. A class that is
 * never instantiated never receives events.
 *
 * ## Something else must hold the listener
 *
 * The global emitter holds listeners **weakly** (see
 * `QueueEvents.subscribeListener`), because it is process-global and would
 * otherwise become the permanent owner of every listener ever constructed
 * (stacksjs/stacks#2282 item 7). The listener therefore has to be reachable from
 * somewhere else — a module-level binding, a service container, a registry.
 * `new EmailNotifications()` as a bare statement is garbage the moment it
 * finishes, and a collected listener stops receiving events.
 *
 * For deterministic teardown call `getQueueEvents().unsubscribeListener(instance)`;
 * `getQueueEvents().off(event)` still clears an event wholesale.
 *
 * ## Instance methods only
 *
 * Static methods, fields, accessors and whole classes are rejected with a
 * `TypeError` at class-definition time — see the guards below for why.
 *
 * @example
 * ```typescript
 * class EmailNotifications {
 *   private completed = 0
 *
 *   @OnQueueEvent('job:completed')
 *   async onJobCompleted(payload: QueueEventPayload) {
 *     this.completed++ // `this` is the EmailNotifications instance
 *   }
 * }
 *
 * // Subscribing happens on `new`, not at class definition — and this binding is
 * // what keeps the listener, and therefore its subscription, alive.
 * export const emailNotifications = new EmailNotifications()
 * ```
 */
export function OnQueueEvent(event: QueueEventType): (
  value: any,
  context: DecoratorContext | string,
) => any {
  return function (
    value: any,
    context: DecoratorContext | string,
  ): any {
    // Legacy decorators (`experimentalDecorators: true`) hand a method decorator the
    // prototype, the property key and a descriptor — and nothing that runs at
    // construction time, so there is no instance here to bind to. Refuse the
    // decoration rather than silently reinstating the unbound, class-wide
    // registration of #2282 item 7; the caller has a compiler flag to flip.
    if (typeof context !== 'object' || context === null) {
      throw new TypeError(
        `@OnQueueEvent('${event}') requires standard (TC39) decorators. `
        + `Legacy decorators ('experimentalDecorators: true') give a method decorator `
        + `no construction-time hook, so the handler cannot be bound to an instance.`,
      )
    }

    // "Has addInitializer" is not a method check: every decorator context except a
    // class field's carries one. Without a `kind` guard, decorating a whole class
    // subscribes the *constructor* as a handler (which then throws "Cannot call a
    // class constructor without |new|" inside emit's swallowed try/catch), and
    // decorating a field dies with an opaque "undefined is not an object (evaluating
    // 'value.bind')". Fail loudly and say which one happened (#2282 item 7).
    if (context.kind !== 'method') {
      throw new TypeError(
        `@OnQueueEvent('${event}') can only decorate a class method, but it was applied `
        + `to a ${context.kind}${context.name === undefined ? '' : ` ('${String(context.name)}')`}. `
        + `Move the handler into a method, or call onQueueEvent('${event}', handler) directly.`,
      )
    }

    // A static method has no instance, so its initializer runs once at
    // class-definition time with `this` set to the constructor. That is #2282 item 7
    // from the other direction: merely importing the module — even through a barrel
    // re-export, even if the class is never used — would subscribe a handler for the
    // life of the process, with no instance to scope or unsubscribe it. The
    // decorator's contract is "subscription happens on `new`" and a static method
    // cannot honour it, so refuse instead of quietly running a second, contradictory
    // lifetime under the same syntax.
    if (context.static) {
      throw new TypeError(
        `@OnQueueEvent('${event}') cannot decorate the static method '${String(context.name)}': `
        + `a static method has no instance, so it would subscribe at class-definition time `
        + `and stay subscribed for the life of the process, even if the class is never used. `
        + `Use an instance method, or subscribe explicitly with `
        + `onQueueEvent('${event}', MyClass.${String(context.name)}).`,
      )
    }

    // `addInitializer` is the only hook a *method* decorator gets into construction:
    // it runs once per `new`, with `this` set to the instance being built, which is
    // what makes a bound, per-instance subscription possible at all. #2282 item 7:
    // the original implementation called `events.on(event, descriptor.value)` at
    // decoration time, so the handler ran with `this` undefined and the class had
    // exactly one class-wide subscription no matter how many instances existed.
    //
    // Caveat worth knowing: TC39 gives a method decorator no *post*-construction
    // hook, so this initializer runs before the constructor body. A constructor that
    // throws would otherwise leave a live subscription bound to a half-built object.
    // `subscribeListener` is what makes that survivable — the half-built object is
    // unreachable, so its subscription is reclaimed instead of firing forever.
    // Closing that hole eagerly would need a lifecycle hook the language does not
    // have.
    context.addInitializer(function (this: unknown) {
      getQueueEvents().subscribeListener(this as object, event, value as QueueEventHandler)
    })

    return value
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
