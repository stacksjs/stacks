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

/** Compare measurements made in the same rotated run, then summarize those ratios. */
export function relativeThroughput(
  targetValues: readonly number[],
  baselineValues: readonly number[],
): RelativeThroughput {
  if (targetValues.length === 0 || targetValues.length !== baselineValues.length)
    throw new Error('Relative throughput requires equal non-empty samples')

  const ratios = targetValues.map((value, index) => {
    const baseline = baselineValues[index]!
    if (!(baseline > 0))
      throw new Error('Relative throughput requires positive baseline samples')
    return value / baseline
  })

  return {
    median: median(ratios),
    spread: { min: Math.min(...ratios), max: Math.max(...ratios) },
  }
}
