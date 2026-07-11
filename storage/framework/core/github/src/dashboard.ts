import type { DashboardData, DashboardOptions, RepoStatus } from './types'
import { fetchBotPRCounts } from './bots'
import { mapWithConcurrency } from './client'
import { fetchAllRepos } from './repos'
import { fetchRepoActiveRuns } from './runners'
import { fetchRepoStatus } from './runs'

const DEFAULT_TTL_MS = 30 * 1000
const DEFAULT_CACHE_PATH = '.cache/dashboard.json'
const DEFAULT_RUNNER_CAP = 20

/**
 * In-memory cache scoped per cache-path. Multiple callers hitting the same
 * disk-backed cache file share state; callers using distinct paths (e.g.
 * test isolation) stay independent.
 */
interface CacheEntry {
  data: DashboardData | null
  savedAt: number
  inflight: Promise<DashboardData> | null
  diskLoaded: boolean
}
const caches = new Map<string, CacheEntry>()

function entryFor(path: string): CacheEntry {
  let e = caches.get(path)
  if (!e) {
    e = { data: null, savedAt: 0, inflight: null, diskLoaded: false }
    caches.set(path, e)
  }
  return e
}

async function loadCacheFromDisk(entry: CacheEntry, path: string): Promise<void> {
  if (entry.diskLoaded)
    return
  entry.diskLoaded = true
  try {
    const file = Bun.file(path)
    if (!(await file.exists()))
      return
    const stored = await file.json() as { data: DashboardData, savedAt: number }
    entry.data = stored.data
    entry.savedAt = stored.savedAt
  }
  catch {
    // corrupt or missing cache file is harmless — we just rebuild
  }
}

async function saveCacheToDisk(path: string, data: DashboardData, savedAt: number): Promise<void> {
  try {
    await Bun.write(path, JSON.stringify({ data, savedAt }))
  }
  catch (err) {
    console.warn('[github/dashboard] cache write failed:', err)
  }
}

/**
 * Build a fresh snapshot — fans out across orgs / repos / bot authors with
 * bounded concurrency, then collates into the `DashboardData` shape the
 * dashboard UI consumes.
 */
async function buildDashboardData(opts: DashboardOptions): Promise<DashboardData> {
  const orgs = opts.orgs
  const runnerCaps = opts.runnerCaps ?? {}
  const defaultRunnerCap = opts.defaultRunnerCap ?? DEFAULT_RUNNER_CAP

  const repos = await fetchAllRepos(orgs, opts.ignoreRepos)
  const statuses = await mapWithConcurrency(repos, 8, r => fetchRepoStatus(r.owner, r.name, r.default_branch))

  const prCountMaps = await Promise.all(
    orgs.flatMap(org => [
      fetchBotPRCounts(org, 'renovate').then(m => ({ type: 'renovate' as const, map: m })),
      fetchBotPRCounts(org, 'github-actions').then(m => ({ type: 'actions' as const, map: m })),
    ]),
  )
  const renovateCounts = new Map<string, number>()
  const actionsCounts = new Map<string, number>()
  for (const { type, map } of prCountMaps) {
    const target = type === 'renovate' ? renovateCounts : actionsCounts
    for (const [k, v] of map) target.set(k, (target.get(k) ?? 0) + v)
  }

  for (const s of statuses) {
    const rCount = renovateCounts.get(s.fullName) ?? 0
    const aCount = actionsCounts.get(s.fullName) ?? 0
    s.renovatePRs = rCount
    s.actionsPRs = aCount
    if (rCount > 0)
      s.renovatePRsUrl = `https://github.com/${s.fullName}/pulls?q=${encodeURIComponent('is:pr is:open author:app/renovate')}`
    if (aCount > 0)
      s.actionsPRsUrl = `https://github.com/${s.fullName}/pulls?q=${encodeURIComponent('is:pr is:open author:app/github-actions')}`
  }

  const runnerCounts = await mapWithConcurrency(repos, 8, async r => ({
    owner: r.owner,
    ...(await fetchRepoActiveRuns(r.owner, r.name)),
  }))
  const runners: Record<string, { running: number, queued: number, cap: number }> = {}
  for (const org of orgs)
    runners[org] = { running: 0, queued: 0, cap: runnerCaps[org] ?? defaultRunnerCap }
  for (const c of runnerCounts) {
    if (!runners[c.owner])
      runners[c.owner] = { running: 0, queued: 0, cap: runnerCaps[c.owner] ?? defaultRunnerCap }
    runners[c.owner]!.running += c.running
    runners[c.owner]!.queued += c.queued
  }

  // failures float to the top of the feed so the dashboard's eye-line lands
  // on what's broken, not on the long tail of green.
  const order: Record<string, number> = { failure: 0, error: 1, pending: 2, success: 3, no_runs: 4 }
  statuses.sort((a: RepoStatus, b: RepoStatus) => (order[a.status] ?? 5) - (order[b.status] ?? 5))

  return {
    repos: statuses,
    fetchedAt: new Date().toISOString(),
    total: statuses.length,
    passing: statuses.filter(r => r.status === 'success').length,
    failing: statuses.filter(r => r.status === 'failure' || r.status === 'error').length,
    pending: statuses.filter(r => r.status === 'pending').length,
    noRuns: statuses.filter(r => r.status === 'no_runs').length,
    runners,
  }
}

/**
 * Aggregated CI/runner snapshot across the configured orgs.
 *
 * Stale-while-revalidate: if a cached snapshot exists, it is returned
 * immediately and a background refresh kicks off once the TTL has elapsed.
 * First-ever call (no in-memory and no on-disk cache) waits for the build
 * so the dashboard renders against real data instead of `null`.
 */
export async function getDashboardData(opts: DashboardOptions): Promise<DashboardData> {
  const ttl = opts.cacheTtlMs ?? DEFAULT_TTL_MS
  const path = opts.cachePath ?? DEFAULT_CACHE_PATH
  const entry = entryFor(path)

  await loadCacheFromDisk(entry, path)
  const now = Date.now()

  if (entry.data) {
    if (now - entry.savedAt >= ttl && !entry.inflight) {
      entry.inflight = buildDashboardData(opts)
        .then(async (data) => {
          entry.data = data
          entry.savedAt = Date.now()
          await saveCacheToDisk(path, data, entry.savedAt)
          return data
        })
        .finally(() => { entry.inflight = null })
      entry.inflight.catch(err => console.warn('[github/dashboard] refresh failed:', err))
    }
    return entry.data
  }

  if (!entry.inflight) {
    entry.inflight = buildDashboardData(opts)
      .then(async (data) => {
        entry.data = data
        entry.savedAt = Date.now()
        await saveCacheToDisk(path, data, entry.savedAt)
        return data
      })
      .finally(() => { entry.inflight = null })
  }
  return entry.inflight
}

/**
 * Drop the in-memory cache for a given cache path. Disk cache is left
 * alone — callers that want a true reset should `Bun.write` an empty file
 * or delete it before re-fetching. Used by tests and by an eventual
 * "Refresh now" UI action.
 */
export function clearDashboardCache(cachePath = DEFAULT_CACHE_PATH): void {
  caches.delete(cachePath)
}
