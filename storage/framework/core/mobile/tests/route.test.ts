import type { LocationApi } from '../src/types'
import type { RouteFix } from '../src/route'
import { describe, expect, it } from 'bun:test'
import { createRouteRecorder, createRouteStats, fixDistance, paceLabel, ROUTE_FULL_READ_MAX_MS, routeReadInterval, routeStats, speedLabel, usableFixes } from '../src/route'

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
      supportsRecordingOwnership: () => true,
      acknowledgeRecording: async () => { throw new Error('Only the app may acknowledge its durable checkpoint') },
      startRecording: async () => { calls.push('start')
        recording = true
        return { id: 'r1', active: true, paused: false, startedAt: 1 } },
      pauseRecording: async () => { calls.push('pause')
        return { id: 'r1', active: true, paused: true, startedAt: 1 } },
      resumeRecording: async () => { calls.push('resume')
        return { id: 'r1', active: true, paused: false, startedAt: 1 } },
      stopRecording: async () => { calls.push('stop')
        recording = false
        return { id: 'r1', active: false, paused: false, startedAt: 1, locations: fixes } },
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
    expect(await recorder.attach({ expectedId: 'r1' })).toMatchObject({ active: true })
    expect(recorder.stats.fixes).toBe(31)
    await recorder.stop()
    expect(await createRouteRecorder({ location: fakeLocation([]).api }).attach({ expectedId: 'r1' })).toBeNull()
  })
})

describe('recorder lifecycle', () => {
  it('reads a function of locationOptions at each start, so a power mode chosen later applies', async () => {
    const started: Record<string, unknown>[] = []
    let id = 0
    const api = {
      supportsRecordingOwnership: () => true,
      startRecording: async (options: Record<string, unknown>) => { started.push(options)
        return { id: `r${++id}`, active: true, paused: false, startedAt: 1 } },
      readRecording: async () => [],
      stopRecording: async () => ({ id: `r${id}`, locations: [] }),
    } as unknown as LocationApi
    let saver = false
    const recorder = createRouteRecorder({ location: api, intervalMs: 60_000, locationOptions: () => saver ? { powerMode: 'saver' } : undefined })
    await recorder.start()
    await recorder.stop()
    saver = true
    await recorder.start()
    await recorder.stop()
    recorder.dispose()
    expect(started).toEqual([{ enableHighAccuracy: true }, { enableHighAccuracy: true, powerMode: 'saver' }])
  })

  it('changes the power mode of the running recording, and says false where it cannot', async () => {
    const set: Array<Record<string, unknown>> = []
    let supported = true
    let failWith: string | null = null
    const api = {
      supportsRecordingOwnership: () => true,
      supportsRecordingPowerMode: () => supported,
      startRecording: async () => ({ id: 'r1', active: true, paused: false, startedAt: 1 }),
      setRecordingPowerMode: async (options: Record<string, unknown>) => {
        if (failWith) throw Object.assign(new Error(failWith), { code: failWith })
        set.push(options)
        return { id: 'r1', active: true, paused: false, startedAt: 1, powerMode: options.powerMode, effectivePowerMode: 'saver' }
      },
      readRecording: async () => [],
      stopRecording: async () => ({ id: 'r1', locations: [] }),
    } as unknown as LocationApi
    const recorder = createRouteRecorder({ location: api, intervalMs: 60_000 })
    expect(await recorder.setPowerMode('saver')).toBe(false)
    await recorder.start()
    expect(await recorder.setPowerMode('saver')).toBe(true)
    expect(await recorder.setPowerMode('auto')).toBe(true)
    expect(set).toEqual([{ expectedId: 'r1', powerMode: 'saver' }, { expectedId: 'r1', powerMode: 'auto' }])
    failWith = 'NO_ACTIVE_RECORDING'
    expect(await recorder.setPowerMode('default')).toBe(false)
    failWith = 'RECORDING_CONFLICT'
    await expect(recorder.setPowerMode('default')).rejects.toMatchObject({ code: 'RECORDING_CONFLICT' })
    failWith = null
    supported = false
    expect(await recorder.setPowerMode('default')).toBe(false)
    expect(set).toHaveLength(2)
    await recorder.stop()
    supported = true
    expect(await recorder.setPowerMode('default')).toBe(false)
    recorder.dispose()
  })

  it('coalesces reads, ignores a late poll after stop, and detaches without stopping native GPS', async () => {
    let release!: (fixes: RouteFix[]) => void
    let reads = 0
    let stops = 0
    const api = {
      supportsRecordingOwnership: () => true,
      acknowledgeRecording: async () => { throw new Error('Only the app may acknowledge its durable checkpoint') },
      startRecording: async () => ({ id: 'r1', active: true, paused: false, startedAt: 1 }),
      readRecording: () => { reads++
        return new Promise<RouteFix[]>(resolve => { release = resolve }) },
      stopRecording: async () => { stops++
        return { id: 'r1', locations: run(60, 3) } },
    } as unknown as LocationApi
    const recorder = createRouteRecorder({ location: api, intervalMs: 10 })
    await recorder.start()
    const first = recorder.refresh()
    const second = recorder.refresh()
    expect(reads).toBe(1)
    const [a, b] = await Promise.all([recorder.stop(), recorder.stop()])
    expect(a).toEqual(b)
    expect(stops).toBe(1)
    release([])
    await Promise.all([first, second])
    expect(recorder.stats.distanceM).toBeGreaterThan(170)
    recorder.dispose()
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(reads).toBe(1)
    expect(stops).toBe(1)
  })

  it('orders native commands even when callers overlap', async () => {
    const calls: string[] = []
    const api = {
      supportsRecordingOwnership: () => true,
      acknowledgeRecording: async () => { throw new Error('Only the app may acknowledge its durable checkpoint') },
      startRecording: async () => { await new Promise(resolve => setTimeout(resolve, 10))
        calls.push('start')
        return { id: 'r1', active: true } },
      pauseRecording: async () => { calls.push('pause') },
      readRecording: async () => [],
      resumeRecording: async () => { calls.push('resume') },
      stopRecording: async () => { calls.push('stop')
        return { id: 'r1', locations: [] } },
    } as unknown as LocationApi
    const recorder = createRouteRecorder({ location: api })
    await Promise.all([recorder.start(), recorder.pause(), recorder.resume(), recorder.stop()])
    expect(calls).toEqual(['start', 'pause', 'resume', 'stop'])
  })

  it('retries a failed stop instead of returning an empty route', async () => {
    let calls = 0
    const api = {
      supportsRecordingOwnership: () => true,
      acknowledgeRecording: async () => { throw new Error('Only the app may acknowledge its durable checkpoint') },
      startRecording: async () => ({ id: 'r1', active: true }),
      stopRecording: async () => { if (++calls === 1) throw new Error('bridge unavailable')
        return { id: 'r1', locations: run(60, 3) } },
    } as unknown as LocationApi
    const recorder = createRouteRecorder({ location: api })
    await recorder.start()
    await expect(recorder.stop()).rejects.toThrow('bridge unavailable')
    expect(await recorder.stop()).toHaveLength(61)
  })
})

it('rejects impossible coordinates and missing accuracy, and clears stale pace when stationary', () => {
  const good = run(60, 3)
  expect(usableFixes([{ ...good[0]!, latitude: 100 }, { ...good[1]!, accuracy: null as any }])).toEqual([])
  const last = good.at(-1)!
  const still = Array.from({ length: 60 }, (_, i) => ({ ...last, timestamp: last.timestamp + (i + 1) * 1000 }))
  expect(routeStats([...good, ...still]).paceSPerKm).toBeNull()
  expect(paceLabel(-60)).toBe('–')
  expect(speedLabel(-3)).toBe('–')
})

describe('route stats kept up as fixes arrive', () => {
  /** A long, mixed recording: running, standing, a pause, rough and repeated fixes. */
  function mixed(): RouteFix[] {
    const first = run(900, 3)
    const last = first.at(-1)!
    const still = standing(120, last.timestamp + 1000)
    const after = run(900, 2.6, still.at(-1)!.timestamp + 90_000).map(fix => ({ ...fix, latitude: fix.latitude + (last.latitude - 52) + 200 / 111_195 }))
    const all = [...first, ...still, ...after]
    all.splice(400, 0, { latitude: 53, longitude: 14, accuracy: 300, timestamp: all[399]!.timestamp + 500 })
    all.splice(800, 0, { ...all[799]! })
    return all
  }

  it('gives the same numbers fed in pieces as all at once', () => {
    const fixes = mixed()
    const whole = routeStats(fixes)
    for (const size of [1, 3, 7, 250]) {
      const counted = createRouteStats()
      let last = counted.stats
      for (let i = 0; i < fixes.length; i += size) last = counted.add(fixes.slice(i, i + size))
      expect(last).toEqual(whole)
    }
  })

  it('counts nothing twice when a host hands back the whole recording each time', () => {
    const fixes = mixed()
    const counted = createRouteStats()
    for (let end = 50; end < fixes.length; end += 500) counted.add(fixes.slice(0, end))
    expect(counted.add(fixes)).toEqual(routeStats(fixes))
    expect(counted.latestTimestamp).toBe(Math.max(...fixes.map(fix => fix.timestamp)))
  })

  it('keeps only the anchors the pace needs on a 20-hour route', () => {
    const counted = createRouteStats()
    const long = run(72_000, 2)
    const started = performance.now()
    for (let i = 0; i < long.length; i += 3) counted.add(long.slice(i, i + 3))
    expect(performance.now() - started).toBeLessThan(2000)
    expect(counted.stats.distanceM).toBeGreaterThan(143_000)
    expect(paceLabel(counted.stats.paceSPerKm)).toBe('8:20')
  })
})

describe('reading a long recording back', () => {
  function host(fixes: RouteFix[], honoursSince: boolean) {
    const reads: Array<number | undefined> = []
    const api = {
      supportsRecordingOwnership: () => true,
      acknowledgeRecording: async () => true,
      startRecording: async () => ({ id: 'r1', active: true, paused: false, startedAt: 1 }),
      getRecordingState: async () => ({ id: 'r1', active: true, paused: false, startedAt: 1 }),
      readRecording: async (options: { since?: number }) => {
        reads.push(options?.since)
        return honoursSince && options?.since !== undefined ? fixes.filter(fix => fix.timestamp > options.since!) : fixes
      },
      stopRecording: async () => ({ id: 'r1', active: false, paused: false, startedAt: 1, locations: fixes }),
    } as unknown as LocationApi
    return { api, reads }
  }

  it('asks only for what is new, and gets the same numbers from either kind of host', async () => {
    const fixes = run(600, 3)
    for (const honoursSince of [true, false]) {
      const recorded: RouteFix[] = fixes.slice(0, 100)
      const { api, reads } = host(recorded, honoursSince)
      const recorder = createRouteRecorder({ location: api })
      await recorder.attach({ expectedId: 'r1' })
      for (let end = 200; end <= fixes.length; end += 100) {
        recorded.push(...fixes.slice(recorded.length, end))
        await recorder.refresh()
      }
      expect(reads[0]).toBeUndefined()
      expect(reads.at(-1)).toBe(fixes[499]!.timestamp)
      expect(recorder.stats).toEqual(routeStats(recorded))
      recorder.dispose()
    }
  })

  it('spaces out whole-recording reads on a long route, never the tail reads', () => {
    expect(routeReadInterval(3000, 600, true)).toBe(3000)
    expect(routeReadInterval(3000, 72_000, false)).toBe(3000)
    expect(routeReadInterval(3000, 7200, true)).toBe(6000)
    expect(routeReadInterval(3000, 72_000, true)).toBe(ROUTE_FULL_READ_MAX_MS)
  })
})
