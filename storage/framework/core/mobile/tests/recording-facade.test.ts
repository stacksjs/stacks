import { afterEach, describe, expect, it } from 'bun:test'
import { heartRate, location } from '../src'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

describe('recording ownership through the public mobile facade', () => {
  it('rejects an old JS adapter even when the native host advertises ownership support', async () => {
    const calls: string[] = []
    const state = { id: 'athlete-a', active: true, paused: false, startedAt: 1000, sampleCount: 1 }
    const service = (name: string) => ({
      acknowledgeRecording: async () => {
        calls.push(`${name}.ack`)
        return true
      },
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
})
