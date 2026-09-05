import type { Driver, LoadResult } from './drivers'
import { assertFixtureQueryCount } from './fixture'

/** Audit the loaded database workload outside throughput and CPU measurement. */
export async function verifyLoadPersistence(file: string, driver: Driver, result: LoadResult, warmupResult: LoadResult | null) {
  const counts = { warmupRequests: warmupResult?.requests ?? 0, measuredRequests: result.requests }
  // A cancelled response can still have executed and logged its SELECT. Its
  // driver count is not a denominator for exact database persistence checks.
  if (!driver.drainsRequests) {
    return {
      ...counts,
      status: 'unverified' as const,
      reason: `${driver.name} does not guarantee completed counts for in-flight requests; use oha for exact query-log count verification`,
    }
  }
  if (result.errors || warmupResult?.errors || result.requests === 0)
    throw new Error('Cannot verify Stacks database logging for a load run with failed or missing requests')
  const persistedQueries = await assertFixtureQueryCount(file, counts.warmupRequests + counts.measuredRequests)
  return { ...counts, status: 'verified' as const, persistedQueries }
}
