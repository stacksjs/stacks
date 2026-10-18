import { afterEach, describe, expect, it } from 'bun:test'
import { heartRate, location } from '../src'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

describe('recording ownership through the public mobile facade', () => {
  it('rejects an incomplete native host even when ownership flags are advertised', async () => {
    const calls: string[] = []
    const state = { id: 'athlete-a', active: true, paused: false, startedAt: 1000, sampleCount: 1 }
    const service = (name: string) => ({
      getRecordingState: async () => { calls.push(`${name}.state`)
        return state },
      pauseRecording: async () => { calls.push(`${name}.pause`)
        return state },
      resumeRecording: async () => { calls.push(`${name}.resume`)
        return state },
      stopRecording: async () => { calls.push(`${name}.stop`)
        return { ...state, locations: [], samples: [] } },
      readRecording: async () => { calls.push(`${name}.read`)
        return [] },
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        craft: {
          platform: 'ios',
          capabilities: { locationRecordingOwnership: true, heartRateRecordingOwnership: true },
          location: service('location'),
          heartRate: service('heartRate'),
        },
      },
    })
    for (const api of [location, heartRate]) {
      for (const command of [
        () => api.acknowledgeRecording({ expectedId: 'athlete-a' }),
        () => api.getRecordingState({ expectedId: 'athlete-a' }),
        () => api.pauseRecording({ expectedId: 'athlete-a' }),
        () => api.resumeRecording({ expectedId: 'athlete-a' }),
        () => api.stopRecording({ expectedId: 'athlete-a' }),
        () => api.readRecording({ expectedId: 'athlete-a' }),
      ]) {
        await expect(command()).rejects.toMatchObject({ code: 'RECORDING_OWNERSHIP_UNSUPPORTED' })
      }
    }
    expect(calls).toEqual([])
  })

  it('forwards every owned recording operation through the installed current SDK adapter', async () => {
    const calls: Array<[string, string, unknown]> = []
    const owned = { expectedId: 'athlete-a' }
    const service = (name: string) => {
      let active = true
      let paused = false
      const state = () => ({ id: owned.expectedId, active, paused, startedAt: 1000, sampleCount: 0 })
      const record = (method: string, options: unknown) => calls.push([name, method, options])
      return {
        getRecordingState: async (options: unknown) => { record('state', options)
          return state() },
        readRecording: async (options: unknown) => { record('read', options)
          return [] },
        pauseRecording: async (options: unknown) => { record('pause', options)
          paused = true
          return state() },
        resumeRecording: async (options: unknown) => { record('resume', options)
          paused = false
          return state() },
        stopRecording: async (options: unknown) => { record('stop', options)
          active = false
          return { ...state(), locations: [], samples: [] } },
        acknowledgeRecording: async (options: unknown) => { record('ack', options)
          if (active) throw new Error('RECORDING_ALREADY_ACTIVE')
          return true },
      }
    }
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { craft: { platform: 'ios', capabilities: { locationRecordingOwnership: true, heartRateRecordingOwnership: true }, location: service('location'), heartRate: service('heartRate') } },
    })
    expect(location.supportsRecordingOwnership()).toBe(true)
    expect(heartRate.supportsRecordingOwnership()).toBe(true)
    await location.getRecordingState(owned)
    await location.readRecording(owned)
    await location.pauseRecording(owned)
    await location.resumeRecording(owned)
    await location.stopRecording(owned)
    expect(await location.acknowledgeRecording(owned)).toBe(true)
    await heartRate.getRecordingState(owned)
    await heartRate.readRecording({ ...owned, since: 1234 })
    await heartRate.pauseRecording(owned)
    await heartRate.resumeRecording(owned)
    await heartRate.stopRecording(owned)
    expect(await heartRate.acknowledgeRecording(owned)).toBe(true)
    expect(calls).toEqual([
      ['location', 'state', owned], ['location', 'read', owned], ['location', 'pause', owned], ['location', 'resume', owned], ['location', 'stop', owned], ['location', 'ack', owned],
      ['heartRate', 'state', owned], ['heartRate', 'read', { ...owned, since: 1234 }], ['heartRate', 'pause', owned], ['heartRate', 'resume', owned], ['heartRate', 'stop', owned], ['heartRate', 'ack', owned],
    ])
  })

})
