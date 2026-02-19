import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

// Mock logging to prevent noisy output and process hanging
mock.module('@stacksjs/logging', () => ({
  log: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    success: () => {},
  },
}))

const { QueueEvents } = await import('../src/events')

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
