import type { Measurement, RoutingRepeat } from './report'
import { median, relativeRange, relativeThroughput } from './statistics'

export function summarizeRoutingMeasurements(
  repeats: readonly RoutingRepeat[],
  targetIds: readonly string[],
  scenarioIds: readonly string[],
  expectedRuns: number,
  fixedRate: boolean,
): Measurement[] {
  return targetIds.flatMap(targetId => scenarioIds.map((scenarioId) => {
    const results = repeats.filter(result => result.targetId === targetId && result.scenarioId === scenarioId)
    if (results.length !== expectedRuns
      || new Set(results.map(result => result.run)).size !== expectedRuns
      || results.some(result => !Number.isSafeInteger(result.run) || result.run < 1 || result.run > expectedRuns))
      throw new Error(`Incomplete measurements for ${targetId}:${scenarioId}`)

    const rpsValues = results.map(result => result.rpsMean)
    const p50s = results.map(result => result.rpsP50).filter((value): value is number => value != null)
    const rawResults = repeats.filter(result => result.targetId === 'bun-raw' && result.scenarioId === scenarioId)
    const rawByRun = rawResults.length === expectedRuns
      ? new Map(rawResults.map(result => [result.run, result]))
      : undefined

    /*
     * Aggregate all-or-nothing. A median taken over only the repeats that
     * happened to report a metric conceals missing evidence.
     */
    const everyValue = (pick: (result: RoutingRepeat) => number | null): number | null => {
      const values = results.map(pick)
      return values.every((value): value is number => value != null && Number.isFinite(value)) ? median(values) : null
    }

    const pooledRequests = results.reduce((sum, result) => sum + result.requests, 0)
    const pooledErrors = results.reduce((sum, result) => sum + result.errors, 0)
    const costs = results.map(result => result.cpuMicrosPerRequest)
    const everyCost = costs.every((value): value is number => value != null && Number.isFinite(value)) ? costs as number[] : null
    const rawCosts = rawByRun && results.map(result => rawByRun.get(result.run)?.cpuMicrosPerRequest ?? null)
    const everyRawCost = rawCosts?.every((value): value is number => value != null && Number.isFinite(value)) ? rawCosts as number[] : null

    return {
      targetId,
      scenarioId,
      rpsMean: median(rpsValues),
      rpsP50: p50s.length ? median(p50s) : null,
      latencyMs: {
        p50: everyValue(result => result.latencyMs.p50),
        p90: everyValue(result => result.latencyMs.p90),
        p99: everyValue(result => result.latencyMs.p99),
      },
      errorRate: pooledRequests > 0 ? pooledErrors / pooledRequests : null,
      cpuPercent: everyValue(result => result.cpuPercent),
      cpuMicrosPerRequest: everyCost ? median(everyCost) : null,
      cpuCostSpread: everyCost ? { min: Math.min(...everyCost), max: Math.max(...everyCost) } : null,
      rateAttained: everyValue(result => result.rateAttained),
      spread: { min: Math.min(...rpsValues), max: Math.max(...rpsValues) },
      rangeRatio: relativeRange(rpsValues),
      relativeToRaw: rawByRun
        ? relativeThroughput(rpsValues, results.map(result => rawByRun.get(result.run)?.rpsMean ?? Number.NaN))
        : null,
      relativeCpuCostToRaw: fixedRate && everyCost && everyRawCost
        ? relativeThroughput(everyCost, everyRawCost)
        : null,
      runs: results.length,
    }
  }))
}
