/**
 * Recording a route: the numbers a person watches while they move (distance,
 * pace), and a small controller over the native recording that produces them.
 *
 * The recording itself is Craft's: fixes are written to disk natively, keep
 * coming with the screen locked (`capabilities.backgroundLocation`), and
 * survive the app being closed. This module only reads them back and
 * summarises them, so what it computes is a live estimate; a server that gets
 * the fixes at the end can do the careful arithmetic (smoothed climb, moving
 * time) once.
 */
import type { Location, LocationApi, LocationOptions, LocationRecordingState } from './types'

/** A fix as Craft records it. */
export interface RouteFix extends Location {
  /** Metres; negative when the altitude is unknown. */
  altitudeAccuracy?: number
}

export interface RouteStats {
  /** Metres covered, drift left out. */
  distanceM: number
  /** Seconds spent moving. */
  movingS: number
  /** Seconds per kilometre over the last stretch; null until there is one. */
  paceSPerKm: number | null
  /** Seconds per kilometre over the whole route so far. */
  averagePaceSPerKm: number | null
  /** Metres per second over the last stretch. */
  speedMps: number | null
  /** Horizontal accuracy of the latest fix, metres: how good the signal is. */
  accuracyM: number | null
  /** Fixes that were accurate enough to count. */
  fixes: number
}

export interface RouteStatsOptions {
  /** Fixes less accurate than this, in metres, are left out. Default 25. */
  maxAccuracyM?: number
  /** The stretch the current pace is measured over, in seconds. Default 30. */
  paceWindowS?: number
}

const EARTH_RADIUS_M = 6371008.8

/** Fixes further apart than this, seconds, are a break in the route (a pause). */
export const ROUTE_GAP_S = 30
const GAP_S = ROUTE_GAP_S

/** Great-circle distance between two fixes, metres. */
export function fixDistance(a: { latitude: number, longitude: number }, b: { latitude: number, longitude: number }): number {
  const toRad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * toRad
  const dLon = (b.longitude - a.longitude) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * toRad) * Math.cos(b.latitude * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The fixes worth counting, oldest first: a known position, accurate enough. */
export function usableFixes<T extends RouteFix>(fixes: readonly T[], maxAccuracyM = 25): T[] {
  const seen = new Set<number>()
  return fixes
    .filter(fix => Number.isFinite(fix.latitude) && Number.isFinite(fix.longitude) && Number.isFinite(fix.timestamp)
      && Math.abs(fix.latitude) <= 90 && Math.abs(fix.longitude) <= 180 && Number.isFinite(fix.accuracy) && fix.accuracy >= 0 && fix.accuracy <= maxAccuracyM)
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((fix) => {
      if (seen.has(fix.timestamp))
        return false
      seen.add(fix.timestamp)
      return true
    })
}

/**
 * The live numbers for a recording.
 *
 * Standing still, GPS wanders a few metres about the true spot, and summing
 * every hop would add distance nobody covered. So distance is counted from an
 * anchor: a fix only counts once it is further from the last counted one than
 * the signal could explain (the larger of 3 m and the fixes' accuracy, capped
 * at 10 m), and then becomes the anchor. Fixes more than ROUTE_GAP_S apart
 * (a pause) are a break: the ground between them is not counted.
 */
export function routeStats(fixes: readonly RouteFix[], options: RouteStatsOptions = {}): RouteStats {
  const usable = usableFixes(fixes, options.maxAccuracyM ?? 25)
  const windowS = options.paceWindowS ?? 30
  const anchors: Array<{ fix: RouteFix, cumM: number }> = []
  let distanceM = 0
  let movingS = 0
  let previous: RouteFix | null = null
  for (const fix of usable) {
    const last = anchors[anchors.length - 1]
    const gap = previous ? (fix.timestamp - previous.timestamp) / 1000 : 0
    previous = fix
    if (!last) {
      anchors.push({ fix, cumM: 0 })
      continue
    }
    // A gap between fixes: the recording was paused, or the signal lost.
    // Wherever the person went meanwhile is not route; carry on from here.
    if (gap > GAP_S) {
      anchors.push({ fix, cumM: distanceM })
      continue
    }
    const seconds = (fix.timestamp - last.fix.timestamp) / 1000
    const step = fixDistance(last.fix, fix)
    const threshold = Math.min(10, Math.max(3, last.fix.accuracy, fix.accuracy))
    if (step < threshold)
      continue
    distanceM += step
    // A stretch slower than a stroll is a pause with drift in it, not moving.
    if (seconds > 0 && step / seconds >= 0.5)
      movingS += seconds
    anchors.push({ fix, cumM: distanceM })
  }

  const latest = anchors[anchors.length - 1]
  let paceSPerKm: number | null = null
  let speedMps: number | null = null
  if (latest && usable.at(-1)!.timestamp - latest.fix.timestamp <= windowS * 1000) {
    const since = latest.fix.timestamp - windowS * 1000
    const start = anchors.find(anchor => anchor.fix.timestamp >= since) ?? latest
    const metres = latest.cumM - start.cumM
    const seconds = (latest.fix.timestamp - start.fix.timestamp) / 1000
    if (metres >= 20 && seconds > 0) {
      speedMps = metres / seconds
      paceSPerKm = seconds / (metres / 1000)
    }
  }

  return {
    distanceM,
    movingS,
    paceSPerKm,
    averagePaceSPerKm: distanceM >= 50 && movingS > 0 ? movingS / (distanceM / 1000) : null,
    speedMps,
    accuracyM: usable.length ? usable[usable.length - 1]!.accuracy : fixes.length ? fixes[fixes.length - 1]!.accuracy ?? null : null,
    fixes: usable.length,
  }
}

/** "5:12" per kilometre, or "–" without a pace. */
export function paceLabel(secondsPerKm: number | null | undefined): string {
  if (secondsPerKm == null || secondsPerKm <= 0 || !Number.isFinite(secondsPerKm) || secondsPerKm > 60 * 60)
    return '–'
  const total = Math.round(secondsPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** "24.3" kilometres per hour. */
export function speedLabel(metresPerSecond: number | null | undefined): string {
  return metresPerSecond != null && metresPerSecond > 0 && Number.isFinite(metresPerSecond) ? (metresPerSecond * 3.6).toFixed(1) : '–'
}

export interface RouteRecorderOptions extends RouteStatsOptions {
  /** How often the recording is read back while shown, ms. Default 3000. */
  intervalMs?: number
  /** Every time the numbers change. */
  onUpdate?: (stats: RouteStats) => void
  /** The location service; `location` from @stacksjs/mobile by default. */
  location: LocationApi
  locationOptions?: LocationOptions
}

export interface RouteRecorder {
  /** Begins a new recording. */
  start: () => Promise<RouteStats>
  /**
   * Picks up a recording already running natively (one that outlived the page
   * or the app), without starting another. Resolves null when there is none.
   */
  attach: () => Promise<LocationRecordingState | null>
  pause: () => Promise<void>
  resume: () => Promise<void>
  /** Ends the recording and hands back every fix it made. */
  stop: () => Promise<RouteFix[]>
  /** Reads the recording now. */
  refresh: () => Promise<RouteStats>
  /** Detaches polling from a page without ending its native recording. */
  dispose: () => void
  readonly stats: RouteStats
}

const EMPTY_STATS: RouteStats = { distanceM: 0, movingS: 0, paceSPerKm: null, averagePaceSPerKm: null, speedMps: null, accuracyM: null, fixes: 0 }

/**
 * A recording to follow: start, pause, resume and stop the native recording,
 * and the live numbers read back from it every few seconds while the page is
 * in front. Reading pauses with the page hidden; the recording does not.
 */
export function createRouteRecorder(options: RouteRecorderOptions): RouteRecorder {
  const location = options.location
  const every = options.intervalMs ?? 3000
  let stats: RouteStats = EMPTY_STATS
  let timer: ReturnType<typeof setInterval> | null = null

  const hidden = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'hidden'

  let generation = 0
  let read: Promise<RouteStats> | null = null
  let commands = Promise.resolve()
  let ending: Promise<RouteFix[]> | null = null
  let disposed = false

  function serialize<T>(run: () => Promise<T>): Promise<T> {
    const result = commands.then(run)
    commands = result.then(() => {}, () => {})
    return result
  }

  function refresh(): Promise<RouteStats> {
    if (read) return read
    const version = generation
    read = (async () => {
      const fixes = await location.readRecording() as RouteFix[]
      if (version === generation && !disposed) {
        stats = routeStats(fixes, options)
        options.onUpdate?.(stats)
      }
      return stats
    })().finally(() => { read = null })
    return read
  }

  function poll(): void {
    stopPolling()
    if (disposed) return
    timer = setInterval(() => {
      if (!hidden())
        void refresh().catch(() => {})
    }, every)
  }

  function stopPolling(): void {
    if (timer)
      clearInterval(timer)
    timer = null
  }

  return {
    get stats() { return stats },
    start() {
      ending = null
      return serialize(async () => {
        await location.startRecording({ enableHighAccuracy: true, ...options.locationOptions })
        generation++
        stats = { ...EMPTY_STATS }
        if (!disposed) options.onUpdate?.(stats)
        poll()
        return stats
      })
    },
    attach() {
      return serialize(async () => {
        const state = await location.getRecordingState()
        if (!state?.active) return null
        await refresh().catch(() => {})
        if (!state.paused) poll()
        return state
      })
    },
    pause() {
      return serialize(async () => {
        await location.pauseRecording()
        stopPolling()
        await refresh().catch(() => {})
      })
    },
    resume() {
      return serialize(async () => {
        await location.resumeRecording()
        poll()
      })
    },
    stop() {
      if (ending) return ending
      ending = serialize(async () => {
        stopPolling()
        generation++
        const result = await location.stopRecording()
        const fixes = (result?.locations ?? []) as RouteFix[]
        stats = routeStats(fixes, options)
        if (!disposed) options.onUpdate?.(stats)
        return fixes
      }).catch((error) => { ending = null; throw error })
      return ending
    },
    dispose() {
      disposed = true
      generation++
      stopPolling()
    },
    refresh,
  }
}
