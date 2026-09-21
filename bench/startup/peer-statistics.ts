import { median } from '../routing/statistics'

export type PeerStartupMetric = 'firstResponseMs' | 'listenMs' | 'rssBytes'

export interface PeerStartupSample {
  firstResponseMs: number
  listenMs: number
  order: number
  response: {
    bodySha256: string
    mediaType: string
    status: number
  }
  rssBytes: number
  run: number
  targetId: string
}

export interface PeerMetricSummary {
  baselineMedian: number
  median: number
  medianPercentChange: number
  pairedMedianRatio: number
  pairedRatios: Array<{ ratio: number, run: number }>
  targetEqualRuns: number
  targetHigherRuns: number
  targetId: string
  targetLowerRuns: number
}

export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0)
    throw new Error('Cannot calculate a percentile without values')
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
    throw new Error(`Percentile fraction must be between 0 and 1, received ${fraction}`)
  if (values.some(value => !Number.isFinite(value)))
    throw new Error('Cannot calculate a percentile from non-finite values')
  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]!
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
}

export function validatePeerStartupSamples(
  samples: readonly PeerStartupSample[],
  runs: number,
  targetIds: readonly string[],
): void {
  if (samples.length !== runs * targetIds.length)
    throw new Error(`Expected ${runs * targetIds.length} peer startup samples, received ${samples.length}`)
  for (let run = 0; run < runs; run++) {
    const rows = samples.filter(sample => sample.run === run)
    if (rows.length !== targetIds.length || new Set(rows.map(row => row.targetId)).size !== targetIds.length)
      throw new Error(`Peer startup run ${run} is incomplete`)
    if (rows.some(row => !targetIds.includes(row.targetId)))
      throw new Error(`Peer startup run ${run} contains an unknown target`)
    const orders = rows.map(row => row.order)
    if (new Set(orders).size !== targetIds.length || orders.some(order => !Number.isSafeInteger(order) || order < 0 || order >= targetIds.length))
      throw new Error(`Peer startup run ${run} has malformed process order`)
  }
  for (const targetId of targetIds) {
    const positionCounts = Array.from({ length: targetIds.length }, (_, order) =>
      samples.filter(sample => sample.targetId === targetId && sample.order === order).length)
    if (Math.max(...positionCounts) - Math.min(...positionCounts) > 1)
      throw new Error(`Peer startup target ${targetId} has unbalanced process positions`)
  }
  for (const sample of samples) {
    if (!Number.isFinite(sample.listenMs) || sample.listenMs <= 0)
      throw new Error(`${sample.targetId} run ${sample.run} has an invalid listen time`)
    if (!Number.isFinite(sample.firstResponseMs) || sample.firstResponseMs < sample.listenMs)
      throw new Error(`${sample.targetId} run ${sample.run} has an invalid response time`)
    if (!Number.isSafeInteger(sample.rssBytes) || sample.rssBytes <= 0)
      throw new Error(`${sample.targetId} run ${sample.run} has an invalid RSS value`)
    if (sample.response.status !== 200 || sample.response.mediaType !== 'application/json' || !/^[a-f\d]{64}$/.test(sample.response.bodySha256))
      throw new Error(`${sample.targetId} run ${sample.run} has invalid response evidence`)
  }
  if (new Set(samples.map(sample => JSON.stringify(sample.response))).size !== 1)
    throw new Error('Peer startup responses are inconsistent')
}

export function summarizePeerStartupMetric(
  samples: readonly PeerStartupSample[],
  runs: number,
  targetIds: readonly string[],
  metric: PeerStartupMetric,
): PeerMetricSummary[] {
  validatePeerStartupSamples(samples, runs, targetIds)
  const baseline = samples.filter(sample => sample.targetId === 'bun-raw')
  if (baseline.length !== runs)
    throw new Error('Peer startup samples require one bun-raw baseline per run')
  const baselineMedian = median(baseline.map(sample => sample[metric]))

  return targetIds.map((targetId) => {
    const target = samples.filter(sample => sample.targetId === targetId)
    const pairedRatios = Array.from({ length: runs }, (_, run) => {
      const targetSample = target.find(sample => sample.run === run)!
      const baselineSample = baseline.find(sample => sample.run === run)!
      return { run, ratio: targetSample[metric] / baselineSample[metric] }
    })
    const center = median(target.map(sample => sample[metric]))
    return {
      targetId,
      median: center,
      baselineMedian,
      medianPercentChange: ((center / baselineMedian) - 1) * 100,
      pairedMedianRatio: median(pairedRatios.map(row => row.ratio)),
      pairedRatios,
      targetLowerRuns: pairedRatios.filter(row => row.ratio < 1).length,
      targetEqualRuns: pairedRatios.filter(row => row.ratio === 1).length,
      targetHigherRuns: pairedRatios.filter(row => row.ratio > 1).length,
    }
  })
}
