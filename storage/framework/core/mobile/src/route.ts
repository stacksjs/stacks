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
import type { HeartRateRecordingApi, HeartRateSample, Location, LocationApi, LocationOptions, LocationRecordingState } from './types'

/** A fix as Craft records it. */
export interface RouteFix extends Location {
  /** Metres; negative when the altitude is unknown. */
  altitudeAccuracy?: number
  /** Beats per minute from a heart-rate strap at about this moment (`attachHeartRate`). */
  heartRate?: number
}

/** A fix and a strap's reading further apart than this, ms, do not belong together. */
export const HEART_RATE_MATCH_MS = 5000

/**
 * The fixes with the heart rate of the reading nearest each one, when there
 * is one within `maxGapMs`: a strap reads about once a second, a phone fixes
 * about once a second, and neither waits for the other. A fix with no reading
 * near it (the strap off, or not worn yet) keeps none.
 */
export function attachHeartRate<T extends RouteFix>(fixes: readonly T[], samples: readonly HeartRateSample[], maxGapMs = HEART_RATE_MATCH_MS): T[] {
  const readings = samples
    .filter(sample => Number.isFinite(sample.timestamp) && Number.isFinite(sample.bpm) && sample.bpm > 0)
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
  if (!readings.length) return fixes.slice()
  return fixes.map((fix) => {
    // The first reading at or after the fix, and the one before it.
    let low = 0
    let high = readings.length
    while (low < high) {
      const middle = (low + high) >> 1
      if (readings[middle]!.timestamp < fix.timestamp) low = middle + 1
      else high = middle
    }
    const after = readings[low]
    const before = readings[low - 1]
    const nearest = !after ? before : !before ? after : fix.timestamp - before.timestamp <= after.timestamp - fix.timestamp ? before : after
    if (!nearest || Math.abs(nearest.timestamp - fix.timestamp) > maxGapMs) return fix
    return { ...fix, heartRate: Math.round(nearest.bpm) }
  })
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

const EMPTY_STATS: RouteStats = { distanceM: 0, movingS: 0, paceSPerKm: null, averagePaceSPerKm: null, speedMps: null, accuracyM: null, fixes: 0 }

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

/** Whether a fix has a real position, time and accuracy no rougher than `maxAccuracyM`. */
function usable(fix: RouteFix, maxAccuracyM: number): boolean {
  return Number.isFinite(fix.latitude) && Number.isFinite(fix.longitude) && Number.isFinite(fix.timestamp)
    && Math.abs(fix.latitude) <= 90 && Math.abs(fix.longitude) <= 180 && Number.isFinite(fix.accuracy) && fix.accuracy >= 0 && fix.accuracy <= maxAccuracyM
}

/**
 * The live numbers for a recording, kept up as fixes arrive: `add` takes the
 * next fixes (a batch read back from the native recording) and counts only
 * those newer than any it has seen, so a reader can hand it a whole recording
 * or just its tail and get the same answer. Each fix is looked at once, and
 * only the anchors inside the pace window are kept, so a 20-hour route costs
 * what its last few seconds do rather than every fix again on every read.
 *
 * `routeStats` is this over one batch.
 */
export interface RouteStatsAccumulator {
  /** Counts the fixes newer than the last one counted; returns the numbers. */
  add: (fixes: readonly RouteFix[]) => RouteStats
  readonly stats: RouteStats
  /** The newest fix time seen, usable or not (epoch ms), or null before any. */
  readonly latestTimestamp: number | null
}

export function createRouteStats(options: RouteStatsOptions = {}): RouteStatsAccumulator {
  const maxAccuracyM = options.maxAccuracyM ?? 25
  const windowMs = (options.paceWindowS ?? 30) * 1000
  // The anchors inside the pace window, oldest first; the last is the latest.
  let anchors: Array<{ fix: RouteFix, cumM: number }> = []
  let distanceM = 0
  let movingS = 0
  let previous: RouteFix | null = null
  let count = 0
  let latestRaw: number | null = null
  let rawAccuracy: number | null = null
  let stats: RouteStats = { ...EMPTY_STATS }

  function take(fix: RouteFix): void {
    const last = anchors[anchors.length - 1]
    const gap = previous ? (fix.timestamp - previous.timestamp) / 1000 : 0
    previous = fix
    count++
    if (!last) {
      anchors.push({ fix, cumM: 0 })
      return
    }
    // A gap between fixes: the recording was paused, or the signal lost.
    // Wherever the person went meanwhile is not route; carry on from here.
    if (gap > GAP_S) {
      anchors.push({ fix, cumM: distanceM })
      return
    }
    const seconds = (fix.timestamp - last.fix.timestamp) / 1000
    const step = fixDistance(last.fix, fix)
    const threshold = Math.min(10, Math.max(3, last.fix.accuracy, fix.accuracy))
    if (step < threshold)
      return
    distanceM += step
    // A stretch slower than a stroll is a pause with drift in it, not moving.
    if (seconds > 0 && step / seconds >= 0.5)
      movingS += seconds
    anchors.push({ fix, cumM: distanceM })
  }

  function summarise(): RouteStats {
    const latest = anchors[anchors.length - 1]
    // Pace looks back from the latest anchor only, so older ones can go.
    if (latest) {
      const since = latest.fix.timestamp - windowMs
      let first = 0
      while (first < anchors.length - 1 && anchors[first]!.fix.timestamp < since) first++
      if (first) anchors = anchors.slice(first)
    }
    let paceSPerKm: number | null = null
    let speedMps: number | null = null
    if (latest && previous!.timestamp - latest.fix.timestamp <= windowMs) {
      const start = anchors[0]!
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
      accuracyM: previous ? previous.accuracy : rawAccuracy,
      fixes: count,
    }
  }

  return {
    get stats() { return stats },
    get latestTimestamp() { return latestRaw },
    add(fixes) {
      if (fixes.length) {
        const lastRaw = fixes[fixes.length - 1]!
        if (!previous) rawAccuracy = lastRaw.accuracy ?? null
        const newest = previous ? previous.timestamp : -Infinity
        const fresh = fixes.filter(fix => usable(fix, maxAccuracyM) && fix.timestamp > newest).sort((a, b) => a.timestamp - b.timestamp)
        for (const fix of fresh) {
          // Repeats of one moment count once.
          if (previous && fix.timestamp <= previous.timestamp) continue
          take(fix)
        }
        for (const fix of fixes) {
          if (Number.isFinite(fix.timestamp) && (latestRaw === null || fix.timestamp > latestRaw)) latestRaw = fix.timestamp
        }
      }
      stats = summarise()
      return stats
    },
  }
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
  return createRouteStats(options).add(fixes)
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
  /**
   * How often the recording is read back while shown, ms. Default 3000. A
   * host that cannot read just the new fixes (`since`) hands back the whole
   * recording each time; then a long one is read less often (see
   * `routeReadInterval`).
   */
  intervalMs?: number
  /** Every time the numbers change. */
  onUpdate?: (stats: RouteStats) => void
  /** The location service; `location` from @stacksjs/mobile by default. */
  location: LocationApi
  locationOptions?: LocationOptions
  /**
   * `heartRate` from @stacksjs/mobile, to record a strap's readings with the
   * route: started, paused, resumed and stopped with it (natively, so they
   * keep coming with the screen locked), and attached to the fixes `stop()`
   * hands back. Recording goes on whether or not a strap is connected yet.
   */
  heartRate?: HeartRateRecordingApi
}

export interface RouteRecorder {
  /** Begins a new recording. */
  start: (intent?: { recordingId: string, heartRateRecordingId?: string }) => Promise<RouteStats>
  /**
   * Picks up a recording already running natively (one that outlived the page
   * or the app), without starting another. A completed owned recording can
   * be collected again after a lost stop acknowledgement; it is never resumed.
   * Resolves null when there is none.
   */
  attach: (options: { expectedId: string, expectedHeartRateId?: string }) => Promise<LocationRecordingState | null>
  pause: () => Promise<void>
  resume: () => Promise<void>
  /** Ends the recording and hands back every fix it made, each with the heart rate near it when one was recorded. */
  stop: () => Promise<RouteFix[]>
  /** Reads the recording now. */
  refresh: () => Promise<RouteStats>
  /** Detaches polling from a page without ending its native recording. */
  dispose: () => void
  readonly stats: RouteStats
  /** The native ID started here or explicitly supplied when recovering a saved recording. */
  readonly recordingId: string | null
  readonly heartRateRecordingId: string | null
  /** Every strap reading the last stopped recording kept, oldest first; empty without `heartRate`. */
  readonly heartRate: HeartRateSample[]
}

/** Past this many fixes (an hour at one a second), a whole-recording read is spaced out. */
export const ROUTE_FULL_READ_FIXES = 3600
/** The longest a whole-recording read is spaced to, ms. */
export const ROUTE_FULL_READ_MAX_MS = 30_000

/**
 * How long to wait before the next read, ms. A host that answers `since` with
 * only the new fixes is read every `everyMs`, however long the route. One that
 * hands back the whole recording costs more with every fix (a 20-hour route
 * is ~72,000 of them through the bridge), so past ROUTE_FULL_READ_FIXES the
 * wait grows with the recording, up to ROUTE_FULL_READ_MAX_MS.
 */
export function routeReadInterval(everyMs: number, fixes: number, wholeReads: boolean): number {
  if (!wholeReads || fixes <= ROUTE_FULL_READ_FIXES) return everyMs
  return Math.max(everyMs, Math.min(ROUTE_FULL_READ_MAX_MS, Math.round(everyMs * fixes / ROUTE_FULL_READ_FIXES)))
}

/**
 * A recording to follow: start, pause, resume and stop the native recording,
 * and the live numbers read back from it every few seconds while the page is
 * in front. Reading pauses with the page hidden; the recording does not.
 */
export function createRouteRecorder(options: RouteRecorderOptions): RouteRecorder {
  const location = options.location
  const every = options.intervalMs ?? 3000
  let stats: RouteStats = EMPTY_STATS
  // The numbers so far for the selected recording, fed only what is new.
  let counted = createRouteStats(options)
  // Whether the host answered a `since` read with fixes it had already sent.
  let wholeReads = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let polling = 0
  const strap = options.heartRate
  let strapRecording = false
  let heartRateRecordingId: string | null = null
  let heartRateSamples: HeartRateSample[] = []

  const hidden = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'hidden'

  let generation = 0
  let read: Promise<RouteStats> | null = null
  let commands = Promise.resolve()
  let ending: Promise<RouteFix[]> | null = null
  let disposed = false
  let recordingId: string | null = null

  function requireOwnership(): void {
    if (disposed)
      throw Object.assign(new Error('The recording screen is no longer active'), { code: 'RECORDING_CONFLICT' })
    if (location.supportsRecordingOwnership?.() !== true)
      throw Object.assign(new Error('This host cannot protect native recording ownership'), { code: 'RECORDING_OWNERSHIP_UNSUPPORTED' })
  }

  function ownedId(): string {
    requireOwnership()
    if (!recordingId)
      throw Object.assign(new Error('A saved recording ID is required'), { code: 'RECORDING_CONFLICT' })
    return recordingId
  }

  function serialize<T>(run: () => Promise<T>): Promise<T> {
    const result = commands.then(run)
    commands = result.then(() => {}, () => {})
    return result
  }

  function refresh(): Promise<RouteStats> {
    if (read) return read
    const version = generation
    const expectedId = recordingId
    const pending = (async () => {
      requireOwnership()
      if (!expectedId)
        throw Object.assign(new Error('A saved recording ID is required'), { code: 'RECORDING_CONFLICT' })
      const accumulator = counted
      const since = accumulator.latestTimestamp
      const fixes = await location.readRecording(since === null ? { expectedId } : { expectedId, since }) as RouteFix[]
      // A held A request receives only A's snapshot, even if B is now selected.
      if (version !== generation || disposed || accumulator !== counted)
        return accumulator.add(fixes)
      if (since !== null && fixes.length && fixes[0]!.timestamp <= since) wholeReads = true
      stats = accumulator.add(fixes)
      options.onUpdate?.(stats)
      return stats
    })().finally(() => { if (read === pending) read = null })
    read = pending
    return pending
  }

  function poll(): void {
    stopPolling()
    if (disposed) return
    const chain = polling
    // One read at a time, each scheduled after the last has answered, so a
    // slow whole-recording read never stacks up behind itself.
    const next = () => {
      timer = setTimeout(() => {
        timer = null
        if (disposed || chain !== polling) return
        const read = hidden() ? Promise.resolve() : refresh().then(() => {}, () => {})
        void read.then(() => { if (!disposed && chain === polling) next() })
      }, routeReadInterval(every, stats.fixes, wholeReads))
    }
    next()
  }

  function stopPolling(): void {
    polling++
    if (timer)
      clearTimeout(timer)
    timer = null
  }

  /** Publish one fully validated selection; no prior recording can update it. */
  function selectRecording(id: string, heartId: string | null, nextStats: RouteStats, accumulator = createRouteStats(options)): void {
    stopPolling()
    generation++
    read = null
    counted = accumulator
    wholeReads = false
    recordingId = id
    heartRateRecordingId = heartId
    strapRecording = heartId !== null
    heartRateSamples = []
    stats = nextStats
    if (!disposed) options.onUpdate?.(stats)
  }

  // The strap's recording follows the route's. A strap that cannot record
  // (no Bluetooth, an older app) never stops the route.
  async function strapDo(run: (api: HeartRateRecordingApi, expectedId: string) => Promise<unknown>): Promise<void> {
    if (!strap || !strapRecording || !heartRateRecordingId || disposed || strap.supportsRecordingOwnership?.() !== true) return
    await run(strap, heartRateRecordingId).catch(() => {})
  }

  return {
    get stats() { return stats },
    get recordingId() { return recordingId },
    get heartRateRecordingId() { return heartRateRecordingId },
    get heartRate() { return heartRateSamples },
    start(intent) {
      ending = null
      return serialize(async () => {
        requireOwnership()
        if (intent && location.supportsRecordingIntentIdentity?.() !== true)
          throw Object.assign(new Error('This host cannot start a registered route identity'), { code: 'RECORDING_INTENT_IDENTITY_UNSUPPORTED' })
        if (intent && (typeof intent.recordingId !== 'string' || !intent.recordingId.trim()))
          throw Object.assign(new Error('A registered recording ID is required'), { code: 'INVALID_ARGUMENT' })
        const started = await location.startRecording({ enableHighAccuracy: true, ...options.locationOptions, ...(intent ? { recordingId: intent.recordingId } : {}) })
        if (!started?.active || typeof started.id !== 'string' || !started.id.trim())
          throw Object.assign(new Error('The native recording did not provide an ID'), { code: 'RECORDING_CONFLICT' })
        if (intent && started.id !== intent.recordingId)
          throw Object.assign(new Error('The native route did not start with its registered ID'), { code: 'RECORDING_CONFLICT' })
        let nextHeartId: string | null = null
        if (!disposed && strap?.isAvailable() && strap.supportsRecordingOwnership?.() === true && (!intent || (intent.heartRateRecordingId && strap.supportsRecordingIntentIdentity?.() === true))) {
          try {
            const startedHeart = await strap.startRecording(intent ? { recordingId: intent.heartRateRecordingId } : undefined)
            if (intent && startedHeart.id !== intent.heartRateRecordingId)
              throw Object.assign(new Error('The native heart rate did not start with its registered ID'), { code: 'RECORDING_CONFLICT' })
            if (startedHeart.active && typeof startedHeart.id === 'string' && startedHeart.id.trim()) {
              nextHeartId = startedHeart.id
            }
          }
          catch { /* Optional heart-rate recording never replaces an existing slot. */ }
        }
        selectRecording(started.id, nextHeartId, { ...EMPTY_STATS })
        poll()
        return stats
      })
    },
    attach(ownership) {
      // A stop requested after this attachment belongs behind it in the
      // command queue, even if the preceding recording already stopped.
      ending = null
      return serialize(async () => {
        if (typeof ownership?.expectedId !== 'string' || !ownership.expectedId.trim())
          throw Object.assign(new Error('A saved recording ID is required'), { code: 'RECORDING_CONFLICT' })
        requireOwnership()
        const state = await location.getRecordingState({ expectedId: ownership.expectedId })
        requireOwnership()
        if (!state?.id) return null
        if (state.id !== ownership.expectedId)
          throw Object.assign(new Error('The recording belongs to another session'), { code: 'RECORDING_CONFLICT' })
        // A global strap recording is not owned merely because this route is.
        let nextHeartId: string | null = null
        if (ownership.expectedHeartRateId !== undefined) {
          const expectedHeartRateId = ownership.expectedHeartRateId
          if (typeof expectedHeartRateId !== 'string' || !expectedHeartRateId.trim())
            throw Object.assign(new Error('A saved heart-rate recording ID is required'), { code: 'RECORDING_CONFLICT' })
          if (!strap?.isAvailable() || strap.supportsRecordingOwnership?.() !== true)
            throw Object.assign(new Error('This host cannot protect heart-rate recording ownership'), { code: 'RECORDING_OWNERSHIP_UNSUPPORTED' })
          const heart = await strap.getRecordingState({ expectedId: expectedHeartRateId })
          requireOwnership()
          if (heart.id !== expectedHeartRateId)
            throw Object.assign(new Error('The heart-rate recording belongs to another session'), { code: 'RECORDING_CONFLICT' })
          await strap.readRecording({ expectedId: expectedHeartRateId, since: Date.now() })
          requireOwnership()
          nextHeartId = expectedHeartRateId
        }
        // Stage this route's own fixes without borrowing an in-flight read
        // from the previous selection. A rejected read changes no public data.
        const fixes = await location.readRecording({ expectedId: ownership.expectedId }) as RouteFix[]
        requireOwnership()
        const accumulator = createRouteStats(options)
        selectRecording(ownership.expectedId, nextHeartId, accumulator.add(fixes), accumulator)
        if (state.active && !state.paused) poll()
        return state
      })
    },
    pause() {
      return serialize(async () => {
        await location.pauseRecording({ expectedId: ownedId() })
        await strapDo((api, expectedId) => api.pauseRecording({ expectedId }))
        stopPolling()
        await refresh().catch(() => {})
      })
    },
    resume() {
      return serialize(async () => {
        await location.resumeRecording({ expectedId: ownedId() })
        await strapDo((api, expectedId) => api.resumeRecording({ expectedId }))
        poll()
      })
    },
    stop() {
      if (ending) return ending
      const pending = serialize(async () => {
        stopPolling()
        generation++
        const expectedId = ownedId()
        const result = await location.stopRecording({ expectedId })
        if (result.id !== expectedId)
          throw Object.assign(new Error('The native recording identity changed'), { code: 'RECORDING_CONFLICT' })
        let fixes = (result?.locations ?? []) as RouteFix[]
        if (!disposed && strap && strapRecording && heartRateRecordingId && strap.supportsRecordingOwnership?.() === true) {
          const recorded = await strap.stopRecording({ expectedId: heartRateRecordingId }).catch(() => null)
          strapRecording = false
          heartRateSamples = recorded?.id === heartRateRecordingId ? recorded.samples : []
          fixes = attachHeartRate(fixes, heartRateSamples)
        }
        stats = routeStats(fixes, options)
        if (!disposed) options.onUpdate?.(stats)
        return fixes
      }).catch((error) => {
        if (ending === pending) ending = null
        throw error
      })
      ending = pending
      return pending
    },
    dispose() {
      disposed = true
      generation++
      read = null
      stopPolling()
    },
    refresh,
  }
}
