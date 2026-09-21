import type { PairedMetricSummary, PairedSample } from './paired'
import { summarizePairedMetric, validatePairedSamples } from './paired'

export interface StartupSample extends PairedSample {
  importMs: number
  rssBytes: number
}

export type StartupMetricName = 'importMs' | 'rssBytes'

export type StartupMetricSummary = PairedMetricSummary

export function validateStartupSamples(samples: readonly StartupSample[], pairs: number): void {
  validatePairedSamples(samples, pairs)

  for (const sample of samples) {
    if (!Number.isFinite(sample.importMs) || sample.importMs <= 0)
      throw new Error(`Pair ${sample.pair} has an invalid import time`)
    if (!Number.isSafeInteger(sample.rssBytes) || sample.rssBytes <= 0)
      throw new Error(`Pair ${sample.pair} has an invalid RSS value`)
  }
}

export function summarizeStartupMetric(
  samples: readonly StartupSample[],
  pairs: number,
  metric: StartupMetricName,
): StartupMetricSummary {
  validateStartupSamples(samples, pairs)
  return summarizePairedMetric(samples, pairs, metric === 'importMs' ? 'import time' : 'RSS value', sample => sample[metric])
}
