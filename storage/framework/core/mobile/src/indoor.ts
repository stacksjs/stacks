/**
 * Whether a run or ride being recorded is happening indoors: on a treadmill,
 * or a bike on a trainer. Read the recording (`location.readRecording()`)
 * every half minute or so while it runs and switch to a timed, GPS-free
 * session when this says 'indoors'.
 *
 * Indoors the phone still reports positions, wandering around the room
 * by tens of metres, and those wanderings added up to kilometres and a pace
 * from nowhere ("2.82 km" and a 5:31 average over fifty minutes on a
 * treadmill). Outside, even a walk leaves a 60-metre circle within a couple
 * of minutes. So once a session has run long enough to tell, a route that
 * never left that circle, a signal that never got good, or no positions at
 * all, means the session is indoors and GPS is the wrong source for it.
 */

export interface IndoorFix {
  latitude: number
  longitude: number
  accuracy?: number | null
  timestamp: number
}

export type IndoorVerdict = 'indoors' | 'outside' | 'unsure'

/** Seconds a session runs before the verdict is trusted. */
export const INDOOR_CHECK_AFTER_S = 150
/** Most fixes within this of the middle, metres: the phone is not going anywhere. */
const STILL_M = 25
/** Most fixes within this, metres, with a vague signal: wandering under a roof. */
const ROOM_M = 50
/** A typical fix sharper than this, metres, is a phone with a view of the sky. */
const SHARP_ACCURACY_M = 10
/** A typical fix this vague, metres, is a phone under a roof. */
const VAGUE_ACCURACY_M = 30
/** Most fixes this far apart, metres, with a sharp signal: clearly outside. */
const GONE_SOMEWHERE_M = 150

function metresBetween(a: { latitude: number, longitude: number }, b: { latitude: number, longitude: number }): number {
  const toRad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * toRad
  const dLon = (b.longitude - a.longitude) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * toRad) * Math.cos(b.latitude * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function percentile(values: number[], share: number): number {
  const sorted = [...values].sort((x, y) => x - y)
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))]!
}

/**
 * `elapsedS` is the session's own time, pauses left out. 'unsure' until it
 * has run INDOOR_CHECK_AFTER_S; 'outside' as soon as the route has clearly
 * gone somewhere.
 *
 * Measured robustly, because indoor GPS jumps: the middle is the median
 * position and the spread is how far the nearest 80% of fixes lie from it,
 * so one fix thrown 150 m across town neither hides a treadmill nor proves a
 * run outside. A 400 m track (fixes within ~60 m of its middle, but sharp)
 * is not mistaken for a treadmill: wandering only counts with a vague signal.
 */
export function indoorVerdict(fixes: IndoorFix[], elapsedS: number): IndoorVerdict {
  const usable = (fixes || []).filter(fix => Number.isFinite(fix?.latitude) && Number.isFinite(fix?.longitude) && Math.abs(fix.latitude) <= 90 && Math.abs(fix.longitude) <= 180)
  const accuracies = usable.filter(fix => fix.accuracy != null).map(fix => Number(fix.accuracy)).filter(value => Number.isFinite(value) && value >= 0)
  const accuracy = accuracies.length ? percentile(accuracies, 0.5) : Number.POSITIVE_INFINITY
  let spread = 0
  if (usable.length) {
    const middle = { latitude: percentile(usable.map(fix => fix.latitude), 0.5), longitude: percentile(usable.map(fix => fix.longitude), 0.5) }
    spread = percentile(usable.map(fix => metresBetween(middle, fix)), 0.8)
  }
  if (usable.length >= 10 && spread > GONE_SOMEWHERE_M && accuracy <= 15)
    return 'outside'
  if (elapsedS < INDOOR_CHECK_AFTER_S)
    return 'unsure'
  if (usable.length < 3 || accuracy > VAGUE_ACCURACY_M || spread < STILL_M)
    return 'indoors'
  if (spread < ROOM_M && accuracy > SHARP_ACCURACY_M)
    return 'indoors'
  return 'unsure'
}

/** A distance typed off a treadmill's display, as kilometres: "8.4", "8,4", "8400 m". */
export function typedDistanceKm(input: string, options: { defaultUnit?: 'km' | 'm' } = {}): number | null {
  const text = String(input || '').trim().toLowerCase().replace(',', '.')
  const match = text.match(/^(\d+(?:\.\d*)?|\.\d+)\s*(km|k|m|mi)?$/)
  if (!match)
    return null
  const value = Number(match[1])
  const unit = match[2] || options.defaultUnit || (value > 100 ? 'm' : 'km')
  const km = unit === 'm' ? value / 1000 : unit === 'mi' ? value * 1.609344 : value
  return Number.isFinite(km) && km >= 0 && km <= 2000 ? Math.round(km * 1000) / 1000 : null
}
