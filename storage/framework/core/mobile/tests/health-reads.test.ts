import { afterEach, describe, expect, it } from 'bun:test'
import { health } from '../src'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function install(craft?: Record<string, unknown>): void {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: craft ? { craft } : {} })
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else delete (globalThis as any).window
})

const reading = { bpm: 52, startDate: 1_000, endDate: 1_000, sourceName: 'Chris’s Apple Watch', deviceName: 'Apple Watch', motionContext: 'sedentary' }
const night = { startDate: 0, endDate: 3_600_000, stage: 'deep', asleep: true, sourceName: 'Chris’s Apple Watch' }

describe('health heart rate and sleep', () => {
  it('reads both through the shell, passing the range on', async () => {
    const calls: unknown[][] = []
    install({
      platform: 'ios',
      health: {
        getHeartRateSamples: async (options: unknown) => { calls.push(['hr', options]); return [reading] },
        getSleepIntervals: async (options: unknown) => { calls.push(['sleep', options]); return [night] },
      },
    })
    expect(await health.getHeartRateSamples({ startDate: 0, endDate: 5_000, limit: 200 })).toEqual([reading] as any)
    expect(await health.getSleepIntervals({ startDate: 0, endDate: 5_000 })).toEqual([night] as any)
    expect(calls).toEqual([['hr', { startDate: 0, endDate: 5_000, limit: 200 }], ['sleep', { startDate: 0, endDate: 5_000 }]])
  })

  it('says which reads the installed build answers', () => {
    install({ platform: 'ios', health: { getWorkouts: async () => [], getHeartRateSamples: async () => [] } })
    expect(health.supports('getHeartRateSamples')).toBe(true)
    expect(health.supports('getWorkouts')).toBe(true)
    expect(health.supports('getSleepIntervals')).toBe(false)
    install({ platform: 'ios', health: {} })
    expect(health.supports('getHeartRateSamples')).toBe(false)
  })

  it('answers nothing, not an error, in a browser or on an older build', async () => {
    install()
    expect(health.supports('getHeartRateSamples')).toBe(false)
    expect(await health.getHeartRateSamples()).toEqual([])
    expect(await health.getSleepIntervals()).toEqual([])
    install({ platform: 'ios', health: {} })
    expect(await health.getHeartRateSamples()).toEqual([])
  })

  it('passes a refusal from HealthKit on, and never hands back a non-list', async () => {
    install({ platform: 'ios', health: { getHeartRateSamples: async () => { throw new Error('Authorization not determined') }, getSleepIntervals: async () => null } })
    await expect(health.getHeartRateSamples()).rejects.toThrow('Authorization not determined')
    expect(await health.getSleepIntervals()).toEqual([])
  })
})

describe('health mindful sessions', () => {
  const sample = { id: 'HK-1', startDate: 0, endDate: 300_000, durationSeconds: 300, sourceName: 'HQ.training', sourceBundleId: 'training.hq.app', ownApp: true, externalId: 'hq-1' }

  it('saves and reads them through the shell', async () => {
    const calls: unknown[][] = []
    install({
      platform: 'ios',
      health: {
        saveMindfulSession: async (session: unknown) => { calls.push(['save', session]); return { id: 'HK-1', externalId: 'hq-1', existing: false } },
        getMindfulSessions: async (options: unknown) => { calls.push(['read', options]); return [sample] },
      },
    })
    expect(health.supports('saveMindfulSession')).toBe(true)
    expect(health.supports('getMindfulSessions')).toBe(true)
    expect(await health.saveMindfulSession({ id: 'hq-1', startDate: 0, endDate: 300_000 })).toEqual({ id: 'HK-1', externalId: 'hq-1', existing: false })
    expect(await health.getMindfulSessions({ startDate: 0 })).toEqual([sample] as any)
    expect(calls).toEqual([['save', { id: 'hq-1', startDate: 0, endDate: 300_000 }], ['read', { startDate: 0 }]])
  })

  it('answers null and [] in a browser or on an older build', async () => {
    install()
    expect(health.supports('saveMindfulSession')).toBe(false)
    expect(await health.saveMindfulSession({ id: 'hq-1', startDate: 0, endDate: 1 })).toBeNull()
    expect(await health.getMindfulSessions()).toEqual([])
    install({ platform: 'ios', health: {} })
    expect(await health.saveMindfulSession({ id: 'hq-1', startDate: 0, endDate: 1 })).toBeNull()
  })

  it('passes a refused write on', async () => {
    install({ platform: 'ios', health: { saveMindfulSession: async () => { throw new Error('Not authorized') }, getMindfulSessions: async () => null } })
    await expect(health.saveMindfulSession({ id: 'hq-1', startDate: 0, endDate: 1 })).rejects.toThrow('Not authorized')
    expect(await health.getMindfulSessions()).toEqual([])
  })
})

describe('health heart rate as it arrives', () => {
  /** A window with a shell and the listeners a page registers on it. */
  function installWithEvents(craft?: Record<string, unknown>) {
    const listeners = new Map<string, Set<(event: any) => void>>()
    const host = {
      ...(craft ? { craft } : {}),
      addEventListener: (name: string, listener: (event: any) => void) => { (listeners.get(name) ?? listeners.set(name, new Set()).get(name)!).add(listener) },
      removeEventListener: (name: string, listener: (event: any) => void) => { listeners.get(name)?.delete(listener) },
    }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: host })
    return { fire: (name: string, detail: unknown) => listeners.get(name)?.forEach(listener => listener({ detail })), count: (name: string) => listeners.get(name)?.size ?? 0 }
  }

  it('starts and stops the stream through the shell, and hands each batch on', async () => {
    const calls: unknown[][] = []
    const host = installWithEvents({
      platform: 'ios',
      health: {
        startHeartRateUpdates: async (options: unknown) => { calls.push(['start', options]); return true },
        stopHeartRateUpdates: async () => { calls.push(['stop']); return true },
      },
    })
    expect(health.supports('startHeartRateUpdates')).toBe(true)
    expect(health.supports('stopHeartRateUpdates')).toBe(true)
    const heard: unknown[] = []
    const stop = health.onHeartRate(samples => heard.push(samples))
    expect(await health.startHeartRateUpdates({ since: 1_000 })).toBe(true)
    host.fire('craftHealthHeartRate', { samples: [reading] })
    host.fire('craftHealthHeartRate', { samples: [] })
    host.fire('craftHealthHeartRate', {})
    expect(heard).toEqual([[reading]])
    stop()
    expect(host.count('craftHealthHeartRate')).toBe(0)
    expect(await health.stopHeartRateUpdates()).toBe(true)
    expect(calls).toEqual([['start', { since: 1_000 }], ['stop']])
  })

  it('says it did not start in a browser or on an older build', async () => {
    installWithEvents()
    expect(health.supports('startHeartRateUpdates')).toBe(false)
    expect(await health.startHeartRateUpdates()).toBe(false)
    expect(await health.stopHeartRateUpdates()).toBe(true)
    expect(typeof health.onHeartRate(() => {})).toBe('function')
    install({ platform: 'ios', health: {} })
    expect(await health.startHeartRateUpdates()).toBe(false)
  })

  it('passes a refusal from HealthKit on', async () => {
    install({ platform: 'ios', health: { startHeartRateUpdates: async () => { throw new Error('Authorization not determined') } } })
    await expect(health.startHeartRateUpdates()).rejects.toThrow('Authorization not determined')
  })
})

describe('health glucose, insulin and carbs', () => {
  const dose = { id: 'HK-ins-1', value: 1.5, unit: 'IU', startDate: 1_000, endDate: 1_000, sourceName: 'Loop', sourceBundleId: 'com.loopkit.Loop', ownApp: false, insulinReason: 'bolus' }

  it('reads one type at a time through the shell, passing the type and range on', async () => {
    const calls: unknown[][] = []
    install({ platform: 'ios', health: { getSamples: async (type: unknown, options: unknown) => { calls.push([type, options]); return [dose] } } })
    expect(health.supports('getSamples')).toBe(true)
    expect(await health.getSamples('insulinDelivery', { startDate: 0, endDate: 5_000, limit: 50 })).toEqual([dose] as any)
    expect(calls).toEqual([['insulinDelivery', { startDate: 0, endDate: 5_000, limit: 50 }]])
  })

  it('answers nothing on a browser or an app build that predates it', async () => {
    install()
    expect(await health.getSamples('bloodGlucose')).toEqual([])
    install({ platform: 'ios', health: {} })
    expect(health.supports('getSamples')).toBe(false)
    expect(await health.getSamples('bloodGlucose')).toEqual([])
  })
})
