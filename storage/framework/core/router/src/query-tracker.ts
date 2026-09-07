import type { EnhancedRequest } from '@stacksjs/bun-router'
import process from 'node:process'
import { getCurrentRequest } from './request-context'

/** Only explicitly configured development environments may expose diagnostics. */
export function isDebugAllowed(): boolean {
  const appEnv = (process.env.APP_ENV ?? '').toLowerCase()
  if (appEnv === 'development') return true
  if (!appEnv && process.env.NODE_ENV === 'development') return true
  return false
}

const MAX_QUERIES = 50
const N1_THRESHOLD = 5

interface QueryTrack {
  buffer: Array<{ query: string, time?: number, connection?: string } | null>
  writeIndex: number
  count: number
  shapeCounts: Map<string, number>
  n1Warned: Set<string>
}

function newQueryTrack(): QueryTrack {
  return {
    buffer: new Array(MAX_QUERIES).fill(null),
    writeIndex: 0,
    count: 0,
    shapeCounts: new Map<string, number>(),
    n1Warned: new Set<string>(),
  }
}

const REQUEST_QUERY_TRACK_KEY = Symbol.for('stacks.queryTracking')
let fallbackTrack: QueryTrack | undefined

function getQueryTrack(): QueryTrack {
  const req = getCurrentRequest() as (EnhancedRequest & { [k: symbol]: unknown }) | undefined
  if (!req) return fallbackTrack ??= newQueryTrack()
  let track = req[REQUEST_QUERY_TRACK_KEY] as QueryTrack | undefined
  if (!track) {
    track = newQueryTrack()
    ;(req as Record<symbol, unknown>)[REQUEST_QUERY_TRACK_KEY] = track
  }
  return track
}

function normalizeQueryShape(query: string): string {
  return query
    .replace(/'(?:[^']|'')*'/g, '?')
    .replace(/"(?:[^"]|"")*"/g, '?')
    .replace(/\b\d+(?:\.\d+)?\b/g, '?')
    .replace(/IN\s*\([^)]*\)/gi, 'IN (?)')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function trackQuery(query: string, time?: number, connection?: string): void {
  const track = getQueryTrack()
  track.buffer[track.writeIndex] = { query, time, connection }
  track.writeIndex = (track.writeIndex + 1) % MAX_QUERIES
  if (track.count < MAX_QUERIES) track.count++

  if (!isDebugAllowed()) return
  const shape = normalizeQueryShape(query)
  if (shape.startsWith('INSERT INTO QUERY_LOGS') || shape.startsWith('EXPLAIN')) return
  const next = (track.shapeCounts.get(shape) ?? 0) + 1
  track.shapeCounts.set(shape, next)
  if (next === N1_THRESHOLD + 1 && !track.n1Warned.has(shape)) {
    track.n1Warned.add(shape)
    import('@stacksjs/logging').then(({ log }) => {
      log.warn(
        `[orm] Possible N+1 - query shape ran ${next}× in this request:\n  ${shape}\n  `
        + `Hint: load related rows with .with('relation') or eager-load via includes() before iterating.`,
      )
    }).catch(() => {})
  }
}

const QUERY_TRACKER_KEY = Symbol.for('stacks.database.queryTracker')
;(globalThis as Record<symbol, unknown>)[QUERY_TRACKER_KEY] = trackQuery

export function getRecentQueries(): Array<{ query: string, time?: number, connection?: string }> {
  const track = getQueryTrack()
  if (track.count === 0) return []
  const result: Array<{ query: string, time?: number, connection?: string }> = []
  const start = track.count < MAX_QUERIES ? 0 : track.writeIndex
  for (let i = 0; i < track.count; i++) {
    const entry = track.buffer[(start + i) % MAX_QUERIES]
    if (entry) result.push(entry)
  }
  return result
}

export function getQueryShapeCounts(): ReadonlyMap<string, number> {
  return new Map(getQueryTrack().shapeCounts)
}

export function clearTrackedQueries(): void {
  const req = getCurrentRequest() as (EnhancedRequest & { [k: symbol]: unknown }) | undefined
  if (req) {
    if (req[REQUEST_QUERY_TRACK_KEY])
      delete (req as Record<symbol, unknown>)[REQUEST_QUERY_TRACK_KEY]
    return
  }
  fallbackTrack = undefined
}
