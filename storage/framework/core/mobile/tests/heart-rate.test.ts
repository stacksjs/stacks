import type { HeartRateRecordingApi, HeartRateSample, LocationApi, RouteFix } from '../src'
import { afterEach, describe, expect, it } from 'bun:test'
import { attachHeartRate, createRouteRecorder, heartRate, mobile } from '../src'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function install(craft?: Record<string, unknown>): EventTarget {
  const events = new EventTarget()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      ...(craft ? { craft } : {}),
    },
  })
  return events
}

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else delete (globalThis as any).window
})

const strap = { id: 'A1B2', name: 'Polar H10', rssi: -51 }

/** The shell's craft.heartRate, answering as CraftHeartRate.swift does. */
function strapShell(calls: unknown[]) {
  let connection = 'disconnected'
  const state = () => ({ available: true, bluetooth: 'poweredOn', authorization: 'authorized', scanning: false, connection, device: connection === 'disconnected' ? null : strap, lastDevice: strap, bpm: null, lastReadingAt: null, recording: { active: false } })
  return {
    platform: 'ios',
    capabilities: { heartRate: true },
    heartRate: {
      getState: async () => state(),
      requestAuthorization: async () => { calls.push('request'); return 'authorized' },
      scan: async (options: unknown) => { calls.push(['scan', options]); return { ...state(), scanning: true } },
      stopScan: async () => state(),
      getDevices: async () => [strap],
      connect: async (id: string) => { calls.push(['connect', id]); connection = 'connected'; return state() },
      reconnect: async () => { calls.push('reconnect'); connection = 'connecting'; return state() },
      disconnect: async (options: unknown) => { calls.push(['disconnect', options]); connection = 'disconnected'; return state() },
      startRecording: async () => ({ id: 'h1', active: true, paused: false, startedAt: 1 }),
      pauseRecording: async () => ({ id: 'h1', active: true, paused: true, startedAt: 1 }),
      resumeRecording: async () => ({ id: 'h1', active: true, paused: false, startedAt: 1 }),
      stopRecording: async () => ({ id: 'h1', active: false, paused: false, startedAt: 1, samples: [{ timestamp: 1000, bpm: 120 }] }),
      getRecordingState: async () => ({ id: 'h1', active: true, paused: false, startedAt: 1, sampleCount: 1 }),
      readRecording: async () => [{ timestamp: 1000, bpm: 120 }],
    },
  }
}

describe('heartRate', () => {
  it('finds, connects to and forgets a strap through the shell', async () => {
    const calls: unknown[] = []
    install(strapShell(calls))
    expect(heartRate.isAvailable()).toBe(true)
    expect(heartRate.supports('readRecording')).toBe(true)
    expect(await heartRate.requestAuthorization()).toBe('authorized')
    expect((await heartRate.scan({ timeout: 10 })).scanning).toBe(true)
    expect(await heartRate.getDevices()).toEqual([strap])
    expect(await heartRate.connect('A1B2')).toMatchObject({ connection: 'connected', device: strap })
    expect((await heartRate.reconnect()).connection).toBe('connecting')
    expect((await heartRate.disconnect({ forget: true })).connection).toBe('disconnected')
    expect(await heartRate.readRecording()).toEqual([{ timestamp: 1000, bpm: 120 }])
    expect(calls).toEqual(['request', ['scan', { timeout: 10 }], ['connect', 'A1B2'], 'reconnect', ['disconnect', { forget: true }]])
    expect(mobile.heartRate).toBe(heartRate)
  })

  it('hears readings, devices and state changes the shell pushes', () => {
    const events = install(strapShell([]))
    const bpm: number[] = []
    const devices: string[] = []
    const states: string[] = []
    const stops = [
      heartRate.onReading(reading => bpm.push(reading.bpm)),
      heartRate.onDevice(device => devices.push(device.name)),
      heartRate.onState(state => states.push(state.connection)),
    ]
    const send = (detail: unknown) => events.dispatchEvent(Object.assign(new Event('craftHeartRate'), { detail }))
    send({ type: 'device', device: strap })
    send({ type: 'reading', bpm: 151, rrIntervals: [397.5], timestamp: 5 })
    send({ type: 'state', connection: 'reconnecting' })
    stops.forEach(stop => stop())
    send({ type: 'reading', bpm: 152, timestamp: 6 })
    expect(bpm).toEqual([151])
    expect(devices).toEqual(['Polar H10'])
    expect(states).toEqual(['reconnecting'])
  })

  it('is unavailable in a browser and in a build without the capability', async () => {
    for (const craft of [undefined, { ...strapShell([]), capabilities: { heartRate: false } }]) {
      install(craft)
      expect(heartRate.isAvailable()).toBe(false)
      expect(await heartRate.getState()).toMatchObject({ available: false, connection: 'disconnected' })
      expect(await heartRate.stopRecording()).toMatchObject({ active: false, samples: [] })
      heartRate.onReading(() => { throw new Error('never') })()
    }
  })
})

describe('attachHeartRate', () => {
  const fix = (timestamp: number): RouteFix => ({ latitude: 52, longitude: 13, accuracy: 5, timestamp })

  it('gives each fix the reading nearest it, within five seconds', () => {
    const samples: HeartRateSample[] = [{ timestamp: 10_400, bpm: 140 }, { timestamp: 9_000, bpm: 130 }, { timestamp: 30_000, bpm: 160 }]
    const fixes = attachHeartRate([fix(9_100), fix(10_000), fix(20_000), fix(34_000), fix(36_000)], samples)
    expect(fixes.map(f => f.heartRate)).toEqual([130, 140, undefined, 160, undefined])
    // The fixes handed in are left as they were.
    expect(attachHeartRate([fix(1)], []).at(0)).toEqual(fix(1))
  })
})

describe('createRouteRecorder with a strap', () => {
  function fakeLocation(fixes: RouteFix[]) {
    const calls: string[] = []
    const state = (active: boolean, paused = false) => ({ id: 'r1', active, paused, startedAt: 1 })
    const api = {
      startRecording: async () => { calls.push('start'); return state(true) },
      pauseRecording: async () => { calls.push('pause'); return state(true, true) },
      resumeRecording: async () => { calls.push('resume'); return state(true) },
      stopRecording: async () => { calls.push('stop'); return { ...state(false), locations: fixes } },
      getRecordingState: async () => state(true),
      readRecording: async () => fixes,
    } as unknown as LocationApi
    return { api, calls }
  }

  function fakeStrap(calls: string[], available = true): HeartRateRecordingApi {
    const state = (active: boolean, paused = false) => ({ id: 'h1', active, paused, startedAt: 1, sampleCount: null })
    return {
      isAvailable: () => available,
      startRecording: async () => { calls.push('hr start'); return state(true) },
      pauseRecording: async () => { calls.push('hr pause'); return state(true, true) },
      resumeRecording: async () => { calls.push('hr resume'); return state(true) },
      stopRecording: async () => { calls.push('hr stop'); return { ...state(false), samples: [{ timestamp: 1_000, bpm: 118 }, { timestamp: 2_000, bpm: 121 }] } },
      getRecordingState: async () => state(true),
      readRecording: async () => [],
    }
  }

  it('records the strap with the route and hands the fixes back with their heart rate', async () => {
    const { api, calls } = fakeLocation([{ latitude: 52, longitude: 13, accuracy: 5, timestamp: 1_000 }, { latitude: 52.001, longitude: 13, accuracy: 5, timestamp: 2_100 }])
    const recorder = createRouteRecorder({ location: api, heartRate: fakeStrap(calls), intervalMs: 1_000_000 })
    await recorder.start()
    await recorder.pause()
    await recorder.resume()
    const fixes = await recorder.stop()
    recorder.dispose()
    expect(calls).toEqual(['start', 'hr start', 'pause', 'hr pause', 'resume', 'hr resume', 'stop', 'hr stop'])
    expect(fixes.map(f => f.heartRate)).toEqual([118, 121])
    expect(recorder.heartRate.map(sample => sample.bpm)).toEqual([118, 121])
  })

  it('records the route alone where there is no strap to record', async () => {
    const { api, calls } = fakeLocation([{ latitude: 52, longitude: 13, accuracy: 5, timestamp: 1_000 }])
    const recorder = createRouteRecorder({ location: api, heartRate: fakeStrap(calls, false), intervalMs: 1_000_000 })
    await recorder.start()
    const fixes = await recorder.stop()
    recorder.dispose()
    expect(calls).toEqual(['start', 'stop'])
    expect(fixes[0]!.heartRate).toBeUndefined()
    expect(recorder.heartRate).toEqual([])
  })

  it('carries on a strap recording that outlived the page with its route', async () => {
    const { api, calls } = fakeLocation([{ latitude: 52, longitude: 13, accuracy: 5, timestamp: 2_000 }])
    const recorder = createRouteRecorder({ location: api, heartRate: fakeStrap(calls), intervalMs: 1_000_000 })
    await recorder.attach()
    const fixes = await recorder.stop()
    recorder.dispose()
    expect(calls).toEqual(['stop', 'hr stop'])
    expect(fixes[0]!.heartRate).toBe(121)
  })
})
