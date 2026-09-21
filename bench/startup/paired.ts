import type { StartupVariant } from './config'
import { median } from '../routing/statistics'

export interface PairedSample {
  order: number
  pair: number
  variant: StartupVariant
}

export interface PairedRatio {
  pair: number
  ratio: number
}

export interface PairedMetricSummary {
  medianDelta: number
  medianPercentChange: number
  pairedMedianRatio: number
  pairedRatios: PairedRatio[]
  rootMedian: number
  runtimeEqualPairs: number
  runtimeHigherPairs: number
  runtimeLowerPairs: number
  runtimeMedian: number
}

export function validatePairedSamples(samples: readonly PairedSample[], pairs: number): void {
  if (!Number.isSafeInteger(pairs) || pairs <= 0)
    throw new Error(`Expected a positive pair count, received ${pairs}`)
  if (samples.length !== pairs * 2)
    throw new Error(`Expected ${pairs * 2} paired samples, received ${samples.length}`)

  for (let pair = 0; pair < pairs; pair++) {
    const rows = samples.filter(sample => sample.pair === pair)
    if (rows.length !== 2)
      throw new Error(`Pair ${pair} must contain exactly two samples`)
    if (new Set(rows.map(row => row.variant)).size !== 2)
      throw new Error(`Pair ${pair} must contain one root and one runtime sample`)
    if (new Set(rows.map(row => row.order)).size !== 2 || rows.some(row => row.order !== 0 && row.order !== 1))
      throw new Error(`Pair ${pair} must contain process orders 0 and 1`)
  }
}

export function summarizePairedMetric<T extends PairedSample>(
  samples: readonly T[],
  pairs: number,
  metricName: string,
  value: (sample: T) => number,
): PairedMetricSummary {
  validatePairedSamples(samples, pairs)
  for (const sample of samples) {
    const measurement = value(sample)
    if (!Number.isFinite(measurement) || measurement <= 0)
      throw new Error(`Pair ${sample.pair} has an invalid ${metricName}`)
  }

  const values = (variant: StartupVariant) => samples
    .filter(sample => sample.variant === variant)
    .map(value)
  const rootMedian = median(values('root'))
  const runtimeMedian = median(values('runtime'))
  const pairedRatios = Array.from({ length: pairs }, (_, pair) => {
    const rows = samples.filter(sample => sample.pair === pair)
    const root = rows.find(sample => sample.variant === 'root')!
    const runtime = rows.find(sample => sample.variant === 'runtime')!
    return { pair, ratio: value(runtime) / value(root) }
  })

  return {
    rootMedian,
    runtimeMedian,
    medianDelta: runtimeMedian - rootMedian,
    medianPercentChange: ((runtimeMedian / rootMedian) - 1) * 100,
    pairedMedianRatio: median(pairedRatios.map(row => row.ratio)),
    pairedRatios,
    runtimeLowerPairs: pairedRatios.filter(row => row.ratio < 1).length,
    runtimeEqualPairs: pairedRatios.filter(row => row.ratio === 1).length,
    runtimeHigherPairs: pairedRatios.filter(row => row.ratio > 1).length,
  }
}
