/**
 * The arithmetic behind the interactive-content probe (stacksjs/stacks#877).
 *
 * Kept pure and DOM-free so the numbers the probe page reports can be checked
 * without a window: the page collects raw `requestAnimationFrame` timestamps and
 * event-to-frame deltas, and everything that turns those into a histogram, a
 * percentile or a dropped-frame count lives here, where a unit test can reach it.
 */

/** Refresh rates a display can plausibly run at, used to snap a measured period. */
export const COMMON_REFRESH_RATES: readonly number[] = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240]

/**
 * The `p`th percentile (0..100) of `values`, by linear interpolation between
 * closest ranks - the same definition as NumPy's default and a spreadsheet's
 * PERCENTILE. Returns null for an empty input rather than inventing a zero.
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0)
    return null
  if (!Number.isFinite(p) || p < 0 || p > 100)
    throw new RangeError(`percentile must be between 0 and 100, got ${p}`)

  const sorted = [...values].sort((a, b) => a - b)
  const rank = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(rank)
  const upper = Math.ceil(rank)
  const low = sorted[lower]!
  const high = sorted[upper]!
  return low + (high - low) * (rank - lower)
}

/** Consecutive differences of a monotonic series of timestamps. */
export function intervals(timestamps: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < timestamps.length; i++)
    out.push(timestamps[i]! - timestamps[i - 1]!)
  return out
}

export interface Histogram {
  /** Width of each bucket in milliseconds. */
  bucketMs: number
  /** counts[i] holds values in [i * bucketMs, (i + 1) * bucketMs). */
  counts: number[]
  /** Values at or beyond `counts.length * bucketMs`. */
  overflow: number
}

/** Fixed-width histogram of `values`, with an explicit overflow bucket. */
export function histogram(values: readonly number[], bucketMs = 1, buckets = 50): Histogram {
  if (bucketMs <= 0 || !Number.isFinite(bucketMs))
    throw new RangeError(`bucketMs must be positive, got ${bucketMs}`)
  if (!Number.isInteger(buckets) || buckets < 1)
    throw new RangeError(`buckets must be a positive integer, got ${buckets}`)

  const counts = Array.from({ length: buckets }, () => 0)
  let overflow = 0
  for (const value of values) {
    const index = Math.floor(Math.max(0, value) / bucketMs)
    if (index >= buckets)
      overflow++
    else
      counts[index]!++
  }
  return { bucketMs, counts, overflow }
}

/**
 * Snap a measured frame period to the nearest common refresh rate when it is
 * within `tolerance` of one, so 8.33 ms reads as 120 Hz rather than 120.05 Hz.
 * Returns the unsnapped rate when nothing is close.
 */
export function snapRefreshRate(periodMs: number, tolerance = 0.03): number {
  if (!(periodMs > 0))
    throw new RangeError(`period must be positive, got ${periodMs}`)
  const measured = 1000 / periodMs
  let best = measured
  let bestError = Number.POSITIVE_INFINITY
  for (const rate of COMMON_REFRESH_RATES) {
    const error = Math.abs(measured - rate) / rate
    if (error < bestError) {
      best = rate
      bestError = error
    }
  }
  return bestError <= tolerance ? best : Math.round(measured * 100) / 100
}

/**
 * Frames that should have been presented and were not.
 *
 * An interval of 2.0 periods means one frame was skipped; 1.4 periods is late
 * but not a skipped frame. Rounding is the usual convention (it matches what a
 * frame-time graph shows as a missing bar).
 */
export function droppedFrames(frameIntervals: readonly number[], periodMs: number): number {
  if (!(periodMs > 0))
    throw new RangeError(`period must be positive, got ${periodMs}`)
  let dropped = 0
  for (const interval of frameIntervals)
    dropped += Math.max(0, Math.round(interval / periodMs) - 1)
  return dropped
}

export interface FramePacingStats {
  /** Callbacks observed. */
  frames: number
  durationMs: number
  /** Callbacks per second over the whole window. */
  fps: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  maxMs: number
  /** The period dropped frames were counted against. */
  targetPeriodMs: number
  /** The refresh rate that period corresponds to. */
  targetHz: number
  droppedFrames: number
  /** Intervals longer than 1.5 target periods. */
  longFrames: number
  histogram: Histogram
}

/**
 * Summarise a run of `requestAnimationFrame` timestamps against a target rate.
 *
 * `targetHz` should be the display's refresh rate when it is known, because
 * that is the rate a game wants. Pass the rate rAF itself runs at to count
 * drops against what the web view actually delivers - the two differ when the
 * web view caps rAF below the display (WebKit's 60 Hz cap on ProMotion panels).
 */
export function framePacing(timestamps: readonly number[], targetHz: number): FramePacingStats | null {
  if (timestamps.length < 3)
    return null
  if (!(targetHz > 0))
    throw new RangeError(`targetHz must be positive, got ${targetHz}`)

  const frameIntervals = intervals(timestamps)
  const durationMs = timestamps[timestamps.length - 1]! - timestamps[0]!
  const targetPeriodMs = 1000 / targetHz
  const round = (value: number) => Math.round(value * 100) / 100

  return {
    frames: timestamps.length,
    durationMs: round(durationMs),
    fps: round(durationMs > 0 ? (frameIntervals.length * 1000) / durationMs : 0),
    p50Ms: round(percentile(frameIntervals, 50)!),
    p95Ms: round(percentile(frameIntervals, 95)!),
    p99Ms: round(percentile(frameIntervals, 99)!),
    maxMs: round(Math.max(...frameIntervals)),
    targetPeriodMs: round(targetPeriodMs),
    targetHz,
    droppedFrames: droppedFrames(frameIntervals, targetPeriodMs),
    longFrames: frameIntervals.filter(interval => interval > targetPeriodMs * 1.5).length,
    histogram: histogram(frameIntervals),
  }
}

export interface LatencyStats {
  samples: number
  p50Ms: number
  p95Ms: number
  maxMs: number
}

/** Percentile summary of latency samples, or null when there were none. */
export function latency(samples: readonly number[]): LatencyStats | null {
  const usable = samples.filter(sample => Number.isFinite(sample) && sample >= 0)
  if (usable.length === 0)
    return null
  const round = (value: number) => Math.round(value * 100) / 100
  return {
    samples: usable.length,
    p50Ms: round(percentile(usable, 50)!),
    p95Ms: round(percentile(usable, 95)!),
    maxMs: round(Math.max(...usable)),
  }
}

/**
 * The refresh rate in a `system_profiler SPDisplaysDataType` resolution string
 * such as `1512 x 982 @ 120.00Hz`, or null when it names none.
 */
export function parseRefreshHz(resolution: string | undefined): number | null {
  const match = resolution?.match(/@\s*([\d.]+)\s*Hz/i)
  if (!match)
    return null
  const hz = Number(match[1])
  return Number.isFinite(hz) && hz > 0 ? hz : null
}
