export function median(values: readonly number[]): number {
  if (values.length === 0)
    throw new Error('Cannot calculate the median of an empty sample')

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

export interface RelativeThroughput {
  median: number
  spread: { min: number, max: number }
}

export const MAX_STABLE_RANGE = 0.1

/**
 * The share of a requested fixed rate a row has to deliver to be comparable.
 *
 * Matches the memory runner's bar. Below it the target is not answering the
 * workload the other rows answered, so its per-request cost is measured over
 * different work and is not a like-for-like figure.
 */
export const MIN_RATE_ATTAINMENT = 0.98

/** Full sample range as a fraction of its median. */
export function relativeRange(values: readonly number[]): number {
  const center = median(values)
  if (!(center > 0))
    return Number.POSITIVE_INFINITY
  return (Math.max(...values) - Math.min(...values)) / center
}

/** Compare paired valid samples; unavailable ratios must not prevent diagnostic output. */
export function relativeThroughput(
  targetValues: readonly number[],
  baselineValues: readonly number[],
): RelativeThroughput | null {
  if (targetValues.length === 0 || targetValues.length !== baselineValues.length)
    throw new Error('Relative throughput requires equal non-empty samples')

  if ([...targetValues, ...baselineValues].some(value => !Number.isFinite(value) || value <= 0))
    return null

  const ratios = targetValues.map((value, index) => value / baselineValues[index]!)
  if (ratios.some(value => !Number.isFinite(value)))
    return null

  return {
    median: median(ratios),
    spread: { min: Math.min(...ratios), max: Math.max(...ratios) },
  }
}
