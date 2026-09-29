import type { LocationApi } from '../src/types'
import type { RouteFix } from '../src/route'
import { describe, expect, it } from 'bun:test'
import { createRouteRecorder, fixDistance, paceLabel, routeStats, speedLabel, usableFixes } from '../src/route'

/** A run due north at `mps` metres a second, one fix a second. */
function run(seconds: number, mps: number, start = 1_000_000, accuracy = 5): RouteFix[] {
  const metresPerDegree = 111_195
  return Array.from({ length: seconds + 1 }, (_, i) => ({
    latitude: 52 + (i * mps) / metresPerDegree,
    longitude: 13,
    accuracy,
    timestamp: start + i * 1000,
  }))
}

/** Standing still, the fix wandering a few metres about one spot. */
function standing(seconds: number, start: number): RouteFix[] {
  return Array.from({ length: seconds }, (_, i) => ({
    latitude: 52 + (Math.sin(i * 1.7) * 2.5) / 111_195,
    longitude: 13 + (Math.cos(i * 2.3) * 2.5) / 68_000,
    accuracy: 6,
    timestamp: start + i * 1000,
  }))
}

describe('route stats', () => {
  it('measures a steady run: distance, pace and moving time', () => {
    const stats = routeStats(run(600, 3))
    expect(stats.distanceM).toBeGreaterThan(1790)
    expect(stats.distanceM).toBeLessThan(1810)
    expect(paceLabel(stats.paceSPerKm)).toBe('5:33')
    expect(paceLabel(stats.averagePaceSPerKm)).toBe('5:33')
    expect(stats.movingS).toBeGreaterThan(590)
    expect(speedLabel(stats.speedMps)).toBe('10.8')
    expect(stats.accuracyM).toBe(5)
  })

  it('adds no distance and no moving time while standing still', () => {
    const stats = routeStats(standing(300, 1_000_000))
    expect(stats.distanceM).toBeLessThan(10)
    expect(stats.movingS).toBe(0)
    expect(stats.paceSPerKm).toBeNull()
  })

  it('leaves out fixes too inaccurate to count, and repeats', () => {
    const fixes = run(60, 3)
    fixes.push({ latitude: 53, longitude: 14, accuracy: 400, timestamp: 1_000_030_500 })
    fixes.push({ ...fixes[10]! })
    expect(usableFixes(fixes)).toHaveLength(61)
    expect(routeStats(fixes).distanceM).toBeLessThan(200)
  })

  it('reads the current pace from the last stretch only', () => {
    const easy = run(300, 2.5)
    const fast = run(60, 4, easy[easy.length - 1]!.timestamp + 1000).map(fix => ({ ...fix, latitude: fix.latitude + (easy[easy.length - 1]!.latitude - 52) }))
    const stats = routeStats([...easy, ...fast])
    expect(paceLabel(stats.paceSPerKm)).toBe('4:10')
    expect(stats.averagePaceSPerKm! > stats.paceSPerKm!).toBe(true)
  })

  it('counts nothing across a pause, wherever the person went meanwhile', () => {
    const before = run(120, 3)
    const last = before[before.length - 1]!
    // Paused for two minutes, walked 300 m on, then resumed.
    const after = run(120, 3, last.timestamp + 120_000).map(fix => ({ ...fix, latitude: fix.latitude + (last.latitude - 52) + 300 / 111_195 }))
    const stats = routeStats([...before, ...after])
    expect(stats.distanceM).toBeGreaterThan(700)
    expect(stats.distanceM).toBeLessThan(740)
    expect(stats.movingS).toBeLessThan(245)
  })

  it('measures great-circle distance', () => {
    expect(Math.round(fixDistance({ latitude: 52, longitude: 13 }, { latitude: 52.001, longitude: 13 }))).toBe(111)
  })
})

describe('createRouteRecorder', () => {
  function fakeLocation(fixes: RouteFix[], active = false) {
    const calls: string[] = []
    let recording = active
    const api = {
      startRecording: async () => { calls.push('start'); recording = true; return { id: 'r1', active: true, paused: false, startedAt: 1 } },
      pauseRecording: async () => { calls.push('pause'); return { id: 'r1', active: true, paused: true, startedAt: 1 } },
      resumeRecording: async () => { calls.push('resume'); return { id: 'r1', active: true, paused: false, startedAt: 1 } },
      stopRecording: async () => { calls.push('stop'); recording = false; return { id: 'r1', active: false, paused: false, startedAt: 1, locations: fixes } },
      getRecordingState: async () => ({ id: recording ? 'r1' : null, active: recording, paused: false, startedAt: recording ? 1 : null }),
      readRecording: async () => fixes,
    } as unknown as LocationApi
    return { api, calls }
  }

  it('starts, reads the numbers back, and hands over every fix at the end', async () => {
    const fixes = run(120, 3)
    const { api, calls } = fakeLocation(fixes)
    const updates: number[] = []
    const recorder = createRouteRecorder({ location: api, intervalMs: 10, onUpdate: stats => updates.push(stats.distanceM) })
    await recorder.start()
    await new Promise(resolve => setTimeout(resolve, 35))
    await recorder.pause()
    await recorder.resume()
    const all = await recorder.stop()
    expect(calls).toEqual(['start', 'pause', 'resume', 'stop'])
    expect(all).toHaveLength(121)
    expect(updates.some(distance => distance > 350)).toBe(true)
    expect(recorder.stats.distanceM).toBeGreaterThan(350)
  })

  it('picks up a recording that outlived the app, and knows when there is none', async () => {
    const running = fakeLocation(run(30, 3), true)
    const recorder = createRouteRecorder({ location: running.api, intervalMs: 1000 })
    expect(await recorder.attach()).toMatchObject({ active: true })
    expect(recorder.stats.fixes).toBe(31)
    await recorder.stop()
    expect(await createRouteRecorder({ location: fakeLocation([]).api }).attach()).toBeNull()
  })
})
