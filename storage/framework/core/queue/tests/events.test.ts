import type { QueueEventPayload } from '../src/events'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

const { QueueEvents, OnQueueEvent, getQueueEvents, emitQueueEvent } = await import('../src/events')

describe('QueueEvents', () => {
  let events: QueueEvents

  beforeEach(() => {
    events = new QueueEvents()
  })

  afterEach(() => {
    events.removeAllListeners()
  })

  describe('on()', () => {
    it('should subscribe to an event and receive payloads', async () => {
      const handler = mock(() => {})

      events.on('job:added', handler)
      await events.emit('job:added', { jobId: '123', queueName: 'default' })

      expect(handler).toHaveBeenCalledTimes(1)
      const payload = handler.mock.calls[0][0]
      expect(payload.jobId).toBe('123')
      expect(payload.queueName).toBe('default')
      expect(payload.timestamp).toBeDefined()
    })

    it('should support multiple handlers for the same event', async () => {
      const handler1 = mock(() => {})
      const handler2 = mock(() => {})

      events.on('job:completed', handler1)
      events.on('job:completed', handler2)
      await events.emit('job:completed', { jobId: '1' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should not fire handler for other events', async () => {
      const handler = mock(() => {})

      events.on('job:completed', handler)
      await events.emit('job:failed', { jobId: '1' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('should return an unsubscribe function', async () => {
      const handler = mock(() => {})

      const unsubscribe = events.on('job:added', handler)
      await events.emit('job:added', { jobId: '1' })
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()
      await events.emit('job:added', { jobId: '2' })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('onAny()', () => {
    it('should receive all events', async () => {
      const handler = mock(() => {})

      events.onAny(handler)
      await events.emit('job:added', { jobId: '1' })
      await events.emit('job:completed', { jobId: '2' })
      await events.emit('job:failed', { jobId: '3' })

      expect(handler).toHaveBeenCalledTimes(3)
      expect(handler.mock.calls[0][0]).toBe('job:added')
      expect(handler.mock.calls[1][0]).toBe('job:completed')
      expect(handler.mock.calls[2][0]).toBe('job:failed')
    })

    it('should return an unsubscribe function', async () => {
      const handler = mock(() => {})

      const unsubscribe = events.onAny(handler)
      await events.emit('job:added', {})
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()
      await events.emit('job:added', {})
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('once()', () => {
    it('should fire handler only once', async () => {
      const handler = mock(() => {})

      events.once('job:added', handler)
      await events.emit('job:added', { jobId: '1' })
      await events.emit('job:added', { jobId: '2' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].jobId).toBe('1')
    })
  })

  describe('emit()', () => {
    it('should add timestamp to payload', async () => {
      const handler = mock(() => {})

      events.on('job:added', handler)
      const before = Date.now()
      await events.emit('job:added', { jobId: '1' })
      const after = Date.now()

      const payload = handler.mock.calls[0][0]
      expect(payload.timestamp).toBeGreaterThanOrEqual(before)
      expect(payload.timestamp).toBeLessThanOrEqual(after)
    })

    it('should not throw when no handlers are registered', async () => {
      await events.emit('job:added', { jobId: '1' })
    })

    it('should continue after handler errors', async () => {
      const handler1 = mock(() => {
        throw new Error('Handler error')
      })
      const handler2 = mock(() => {})

      events.on('job:added', handler1)
      events.on('job:added', handler2)
      await events.emit('job:added', { jobId: '1' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  describe('off()', () => {
    it('should remove all handlers for an event', async () => {
      const handler = mock(() => {})

      events.on('job:added', handler)
      events.off('job:added')
      await events.emit('job:added', { jobId: '1' })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('removeAllListeners()', () => {
    it('should remove all handlers', async () => {
      const handler1 = mock(() => {})
      const handler2 = mock(() => {})
      const wildcard = mock(() => {})

      events.on('job:added', handler1)
      events.on('job:completed', handler2)
      events.onAny(wildcard)

      events.removeAllListeners()

      await events.emit('job:added', {})
      await events.emit('job:completed', {})

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(wildcard).not.toHaveBeenCalled()
    })
  })
})

/**
 * JSC scans the machine stack conservatively, so a handful of just-allocated
 * objects can survive a forced GC because a dead register still points at them.
 * The leak tests below therefore assert the retention *policy* — the global emitter
 * must not be the owner of every listener ever constructed (stacksjs/stacks#2282
 * item 7) — with a small tolerance, instead of asserting exact GC timing. Before
 * the fix these counts stayed at the full spawn count, so the tolerance never
 * hides the regression.
 */
const GC_STRAGGLERS = 5

async function settleGarbage(): Promise<void> {
  for (let round = 0; round < 3; round++) {
    // Overwrite the stack slots that may still be pointing at the listeners.
    const junk: object[] = []
    for (let i = 0; i < 2000; i++)
      junk.push({ i })
    junk.length = 0

    Bun.gc(true)
    // WeakRef targets are kept alive for the remainder of the current job, so a
    // turn of the event loop has to pass before they can be collected at all.
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

describe('OnQueueEvent()', () => {
  // The decorator subscribes on the process-global emitter, so the batch events
  // these cases use have to be cleared by hand between them.
  afterEach(() => {
    getQueueEvents().off('batch:added')
    getQueueEvents().off('batch:completed')
    getQueueEvents().off('batch:failed')
  })

  it('should bind the handler to the instance it was declared on', async () => {
    class BatchListener {
      received: string[] = []

      @OnQueueEvent('batch:completed')
      onCompleted(payload: QueueEventPayload): void {
        this.received.push(payload.jobId!)
      }
    }

    const listener = new BatchListener()
    await emitQueueEvent('batch:completed', { jobId: 'job-1' })

    expect(listener.received).toEqual(['job-1'])
  })

  it('should subscribe once per instance, not once per class', async () => {
    class BatchListener {
      count = 0

      @OnQueueEvent('batch:completed')
      onCompleted(): void {
        this.count++
      }
    }

    const first = new BatchListener()
    const second = new BatchListener()
    await emitQueueEvent('batch:completed', { jobId: 'job-1' })

    expect(first.count).toBe(1)
    expect(second.count).toBe(1)
  })

  it('should not subscribe a class that is never instantiated', async () => {
    const handler = mock(() => {})

    class BatchListener {
      @OnQueueEvent('batch:failed')
      onFailed(): void {
        handler()
      }
    }

    expect(typeof BatchListener).toBe('function')
    expect(getQueueEvents().listenerCount('batch:failed')).toBe(0)

    await emitQueueEvent('batch:failed', { jobId: 'job-1' })

    expect(handler).not.toHaveBeenCalled()
  })

  // #2282 item 7: `addInitializer` on a *static* method runs at class-definition
  // time with `this` set to the constructor, so the previous implementation
  // subscribed a permanent handler for a class nobody ever used. The instance-method
  // case above cannot see that — only adding `static` can.
  it('should refuse a static method instead of subscribing at class-definition time', async () => {
    const handler = mock(() => {})

    expect(() => {
      class StaticListener {
        @OnQueueEvent('batch:failed')
        static onFailed(): void {
          handler()
        }
      }

      return StaticListener
    }).toThrow(/cannot decorate the static method 'onFailed'/)

    expect(getQueueEvents().listenerCount('batch:failed')).toBe(0)
    await emitQueueEvent('batch:failed', { jobId: 'job-1' })

    expect(handler).not.toHaveBeenCalled()
  })

  // #2282 item 7: every decorator context except a field's has `addInitializer`, so
  // checking only for that let a *class* decoration subscribe the constructor.
  it('should refuse a class decoration instead of subscribing the constructor', async () => {
    let constructed = 0
    const decorate = OnQueueEvent('batch:added') as (value: any, context: any) => any

    expect(() => {
      @decorate
      class WholeClass {
        constructor() {
          constructed++
        }
      }

      return WholeClass
    }).toThrow(/can only decorate a class method, but it was applied to a class/)

    expect(getQueueEvents().listenerCount('batch:added')).toBe(0)
    await emitQueueEvent('batch:added', { jobId: 'job-1' })

    expect(constructed).toBe(0)
  })

  it('should refuse non-method members with a message that names the kind', () => {
    const decorate = OnQueueEvent('batch:failed') as (value: any, context: any) => any

    expect(() => {
      class FieldListener {
        @decorate
        onFailed = (): void => {}
      }

      return new FieldListener()
    }).toThrow(/can only decorate a class method, but it was applied to a field \('onFailed'\)/)

    expect(() => {
      class GetterListener {
        @decorate
        get onFailed(): () => void {
          return () => {}
        }
      }

      return new GetterListener()
    }).toThrow(/can only decorate a class method, but it was applied to a getter \('onFailed'\)/)

    expect(getQueueEvents().listenerCount('batch:failed')).toBe(0)
  })

  it('should reject legacy decoration instead of registering an unbound handler', async () => {
    const handler = mock(() => {})
    const descriptor: PropertyDescriptor = { value: handler }
    const decorate = OnQueueEvent('batch:failed') as (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ) => unknown

    expect(() => decorate({}, 'onFailed', descriptor)).toThrow(/standard \(TC39\) decorators/)

    await emitQueueEvent('batch:failed', { jobId: 'job-1' })
    expect(handler).not.toHaveBeenCalled()
  })

  // #2282 item 7: the emitter is process-global, so without a teardown path every
  // `new` added a handler that outlived the listener and lengthened emit's serial
  // await-loop for the rest of the process.
  it('should drop every subscription of a listener that is explicitly unsubscribed', async () => {
    class BatchListener {
      completed = 0
      failed = 0

      @OnQueueEvent('batch:completed')
      onCompleted(): void {
        this.completed++
      }

      @OnQueueEvent('batch:failed')
      onFailed(): void {
        this.failed++
      }
    }

    const listener = new BatchListener()
    await emitQueueEvent('batch:completed', { jobId: 'job-1' })

    expect(listener.completed).toBe(1)
    expect(getQueueEvents().listenerCount('batch:completed')).toBe(1)
    expect(getQueueEvents().listenerCount('batch:failed')).toBe(1)

    expect(getQueueEvents().unsubscribeListener(listener)).toBe(2)
    expect(getQueueEvents().listenerCount('batch:completed')).toBe(0)
    expect(getQueueEvents().listenerCount('batch:failed')).toBe(0)

    await emitQueueEvent('batch:completed', { jobId: 'job-2' })
    await emitQueueEvent('batch:failed', { jobId: 'job-3' })

    expect(listener.completed).toBe(1)
    expect(listener.failed).toBe(0)

    // Nothing left to remove, and no throw on a second call.
    expect(getQueueEvents().unsubscribeListener(listener)).toBe(0)
  })

  it('should not keep subscriptions alive for listeners nothing references', async () => {
    class BatchListener {
      @OnQueueEvent('batch:completed')
      onCompleted(): void {}
    }

    // Constructed in a separate frame so no local binding keeps them reachable.
    const spawn = (count: number): void => {
      for (let i = 0; i < count; i++)
        void new BatchListener()
    }

    spawn(200)
    expect(getQueueEvents().listenerCount('batch:completed')).toBe(200)

    await settleGarbage()
    // emit prunes any subscription whose listener has been collected.
    await emitQueueEvent('batch:completed', { jobId: 'job-1' })

    expect(getQueueEvents().listenerCount('batch:completed')).toBeLessThanOrEqual(GC_STRAGGLERS)
  })

  // #2282 item 7: TC39 runs a method decorator's initializer *before* the
  // constructor body, so a constructor that throws used to leave a permanent
  // subscription bound to a half-built object.
  it('should not leave live subscriptions behind when the constructor throws', async () => {
    let fired = 0

    class BrokenListener {
      constructor() {
        throw new Error('constructor failed')
      }

      @OnQueueEvent('batch:failed')
      onFailed(): void {
        fired++
      }
    }

    const constructAndFail = (count: number): void => {
      for (let i = 0; i < count; i++)
        expect(() => new BrokenListener()).toThrow('constructor failed')
    }

    constructAndFail(50)

    // The initializer runs before the constructor body, so every failed `new` really
    // did subscribe — that part is not fixable from a method decorator.
    expect(getQueueEvents().listenerCount('batch:failed')).toBe(50)

    await settleGarbage()
    await emitQueueEvent('batch:failed', { jobId: 'job-1' })

    // What is fixable: the half-built objects are unreachable, so their
    // subscriptions do not survive. Before the fix both numbers stayed at 50.
    expect(fired).toBeLessThanOrEqual(GC_STRAGGLERS)
    expect(getQueueEvents().listenerCount('batch:failed')).toBeLessThanOrEqual(GC_STRAGGLERS)
  })
})

describe('QueueEvents.subscribeListener()', () => {
  it('should invoke the method with `this` bound to the listener', async () => {
    const events = new QueueEvents()

    class Counter {
      count = 0
      bump(): void {
        this.count++
      }
    }

    const counter = new Counter()
    events.subscribeListener(counter, 'job:added', Counter.prototype.bump)

    await events.emit('job:added', { jobId: '1' })

    expect(counter.count).toBe(1)
    expect(events.listenerCount('job:added')).toBe(1)
  })

  it('should report wildcard handlers through listenerCount', () => {
    const events = new QueueEvents()

    expect(events.listenerCount('*')).toBe(0)
    events.onAny(() => {})
    expect(events.listenerCount('*')).toBe(1)
    expect(events.listenerCount('job:added')).toBe(0)
  })

  it('should return 0 from unsubscribeListener for an unknown listener', () => {
    const events = new QueueEvents()

    expect(events.unsubscribeListener({})).toBe(0)
  })

  it('should not report removals for handlers removeAllListeners already dropped', async () => {
    const events = new QueueEvents()

    class Counter {
      count = 0
      bump(): void {
        this.count++
      }
    }

    const counter = new Counter()
    events.subscribeListener(counter, 'job:added', Counter.prototype.bump)
    expect(events.listenerCount('job:added')).toBe(1)

    events.removeAllListeners()
    expect(events.listenerCount('job:added')).toBe(0)
    expect(events.unsubscribeListener(counter)).toBe(0)

    await events.emit('job:added', { jobId: '1' })
    expect(counter.count).toBe(0)
  })
})

describe('QueueMetrics API', () => {
  it('QueueMetrics should be importable and constructable', async () => {
    const { QueueMetrics } = await import('../src/events')
    expect(typeof QueueMetrics).toBe('function')
  })

  it('QueueMetrics prototype should have getMetrics, reset, and stop', async () => {
    const { QueueMetrics } = await import('../src/events')
    expect(typeof QueueMetrics.prototype.getMetrics).toBe('function')
    expect(typeof QueueMetrics.prototype.reset).toBe('function')
    expect(typeof QueueMetrics.prototype.stop).toBe('function')
  })
})
