import { afterEach, describe, expect, it } from 'bun:test'
import { storage } from '../src/storage'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

function host(supported: boolean, services: Record<string, unknown>) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { craft: { platform: 'android', capabilities: { storageCompareAndSet: supported }, storage: services } },
  })
}

describe('the named SDK durable storage facade', () => {
  it('rejects an older host without a get/set substitute for CAS', async () => {
    const calls: string[] = []
    host(false, {
      get: async () => {
        calls.push('get')
        return {}
      },
      set: async () => {
        calls.push('set')
        return true
      },
      compareAndSet: async () => {
        calls.push('cas')
        return true
      },
    })
    expect(storage.supportsCompareAndSet()).toBe(false)
    await expect(storage.compareAndSet('draft', {}, {})).rejects.toMatchObject({ code: 'STORAGE_COMPARE_AND_SET_UNSUPPORTED' })
    expect(calls).toEqual([])
  })

  it('forwards ordinary calls and preserves a native CAS conflict as false', async () => {
    const calls: Array<[string, ...unknown[]]> = []
    const previous = { workoutId: 42, note: 'Old' }
    const next = { workoutId: 42, note: 'New' }
    host(true, {
      get: async (key: string) => {
        calls.push(['get', key])
        return previous
      },
      set: async (key: string, value: unknown) => {
        calls.push(['set', key, value])
        return true
      },
      remove: async (key: string) => {
        calls.push(['remove', key])
        return true
      },
      clear: async () => {
        calls.push(['clear'])
        return true
      },
      keys: async () => {
        calls.push(['keys'])
        return ['draft']
      },
      compareAndSet: async (...args: unknown[]) => {
        calls.push(['cas', ...args])
        return false
      },
    })
    expect(storage.supportsCompareAndSet()).toBe(true)
    expect(await storage.get('draft')).toEqual(previous)
    expect(await storage.set('draft', next)).toBe(true)
    expect(await storage.keys()).toEqual(['draft'])
    expect(await storage.compareAndSet('draft', previous, next)).toBe(false)
    expect(await storage.remove('draft')).toBe(true)
    expect(await storage.clear()).toBe(true)
    expect(calls).toEqual([['get', 'draft'], ['set', 'draft', next], ['keys'], ['cas', 'draft', previous, next], ['remove', 'draft'], ['clear']])
  })

  it('propagates a native storage failure without reading or writing a fallback', async () => {
    const calls: string[] = []
    host(true, {
      get: async () => {
        calls.push('get')
        return {}
      },
      set: async () => {
        calls.push('set')
        return true
      },
      compareAndSet: async () => {
        calls.push('cas')
        throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' })
      },
    })
    await expect(storage.compareAndSet('draft', {}, {})).rejects.toMatchObject({ code: 'ENOSPC' })
    expect(calls).toEqual(['cas'])
  })
})
