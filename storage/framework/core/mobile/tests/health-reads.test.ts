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
