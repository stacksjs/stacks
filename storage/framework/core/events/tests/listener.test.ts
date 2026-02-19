import { afterEach, describe, expect, it, mock } from 'bun:test'
import { existsSync } from 'node:fs'
import { dispatch, emitter } from '../src'
import { appPath, listenersPath } from '@stacksjs/path'

describe('Event Listener System', () => {
  describe('app/Events.ts configuration', () => {
    it('should export a valid events config', async () => {
      const eventsModule = await import(appPath('Events.ts'))
      const eventsConfig = eventsModule.default

      expect(typeof eventsConfig).toBe('object')
      expect(eventsConfig).not.toBeNull()
    })

    it('should map event names to string arrays of listener names', async () => {
      const eventsModule = await import(appPath('Events.ts'))
      const eventsConfig = eventsModule.default

      for (const [eventName, listeners] of Object.entries(eventsConfig)) {
        expect(typeof eventName).toBe('string')
        expect(Array.isArray(listeners)).toBe(true)
        for (const listener of listeners as string[]) {
          expect(typeof listener).toBe('string')
        }
      }
    })

    it('should have user:registered mapped to SendWelcomeEmail', async () => {
      const eventsModule = await import(appPath('Events.ts'))
      expect(eventsModule.default['user:registered']).toContain('SendWelcomeEmail')
    })

    it('should have user:created mapped to NotifyUser', async () => {
      const eventsModule = await import(appPath('Events.ts'))
      expect(eventsModule.default['user:created']).toContain('NotifyUser')
    })
  })

  describe('Action modules referenced by Events.ts', () => {
    it('SendWelcomeEmail action should exist and have a handle method', async () => {
      const path = appPath('Actions/SendWelcomeEmail.ts')
      expect(existsSync(path)).toBe(true)

      const mod = await import(path)
      expect(typeof mod.default.handle).toBe('function')
    })

    it('NotifyUser action should exist and have a handle method', async () => {
      const path = appPath('Actions/NotifyUser.ts')
      expect(existsSync(path)).toBe(true)

      const mod = await import(path)
      expect(typeof mod.default.handle).toBe('function')
    })

    it('SendWelcomeEmail should return a success result', async () => {
      const mod = await import(appPath('Actions/SendWelcomeEmail.ts'))
      const result = await mod.default.handle({ to: 'test@example.com', name: 'Test' })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })

    it('NotifyUser should return a success result', async () => {
      const mod = await import(appPath('Actions/NotifyUser.ts'))
      const result = await mod.default.handle({ id: 1, name: 'Test' })

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
  })

  describe('app/Listener.ts', () => {
    it('should export handleEvents function', async () => {
      const listener = await import(appPath('Listener.ts'))
      expect(typeof listener.handleEvents).toBe('function')
    })

    it('handleEvents should register a wildcard handler', async () => {
      const sizeBefore = (emitter.all.get('*') || []).length
      const { handleEvents } = await import(appPath('Listener.ts'))
      await handleEvents()
      const sizeAfter = (emitter.all.get('*') || []).length

      expect(sizeAfter).toBeGreaterThan(sizeBefore)

      // Clean up: remove the last wildcard handler we added
      const handlers = emitter.all.get('*') || []
      if (handlers.length > 0) {
        handlers.pop()
      }
    })
  })

  describe('app/Listeners/Console.ts', () => {
    it('should exist', () => {
      expect(existsSync(listenersPath('Console.ts'))).toBe(true)
    })

    it('should export a default function', async () => {
      const mod = await import(listenersPath('Console.ts'))
      expect(typeof mod.default).toBe('function')
    })

    it('should accept a CLI instance as parameter', async () => {
      const mod = await import(listenersPath('Console.ts'))
      // The function accepts 1 parameter (cli)
      expect(mod.default.length).toBeLessThanOrEqual(1)
    })

    it('should register event handlers on the CLI instance', async () => {
      const mod = await import(listenersPath('Console.ts'))

      // Create a mock CLI object
      const registeredEvents: string[] = []
      const mockCli = {
        on: mock((event: string) => {
          registeredEvents.push(event)
        }),
        args: [],
      }

      mod.default(mockCli)

      // Should register at least the wildcard handler
      expect(mockCli.on).toHaveBeenCalled()
      expect(registeredEvents).toContain('inspire:*')
    })
  })
})

describe('Event dispatch performance', () => {
  it('should dispatch 1000 events in under 50ms', () => {
    const handler = mock(() => {})
    emitter.on('perf:test' as any, handler)

    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      emitter.emit('perf:test' as any, { i })
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)
    expect(handler).toHaveBeenCalledTimes(1000)

    emitter.off('perf:test' as any, handler)
  })

  it('should handle rapid registration and dispatch', () => {
    const handlers = Array.from({ length: 100 }, () => mock(() => {}))

    for (const h of handlers) {
      emitter.on('rapid:test' as any, h)
    }

    emitter.emit('rapid:test' as any, { test: true })

    for (const h of handlers) {
      expect(h).toHaveBeenCalledTimes(1)
      emitter.off('rapid:test' as any, h)
    }
  })
})
