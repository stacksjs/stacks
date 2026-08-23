/**
 * The fixed scenario matrix every framework under test answers.
 *
 * One list, imported by both the servers and the runner, so a scenario can
 * never mean one path on the server and another in the load generator. Every
 * server in `servers/` must expose all four routes with byte-identical
 * response bodies — the runner asserts that before it measures anything, which
 * is what stops "framework A is faster" from quietly meaning "framework A
 * answered something smaller".
 */

export type BenchMethod = 'GET' | 'POST'

export interface Scenario {
  /** Stable id, used in filenames and report rows. */
  id: string
  /** Human-readable row label in the generated report. */
  title: string
  method: BenchMethod
  /** Concrete request path (params already filled in). */
  path: string
  /** Pre-serialized JSON body, for POST scenarios. */
  body?: string
  /** Skipped unless the runner prepared the SQLite fixture. */
  requiresDb?: boolean
  /** Exact response body every server must return, for the parity check. */
  expect: string
}

/**
 * The token the "warm client" profile echoes back.
 *
 * A browser has a CSRF cookie from its first response onward, so every request
 * after that one carries it. A load generator that never sends one measures a
 * cold first visit repeated a million times, which is not the traffic anybody
 * actually serves. Both are worth knowing; see the README's profile table.
 */
export const CSRF_COOKIE = 'X-CSRF-Token=bench-fixed-token-0123456789abcdef'

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'static-json',
    title: 'GET, static JSON literal (no params, no middleware, no DB)',
    method: 'GET',
    path: '/bench/json',
    expect: '{"hello":"world"}',
  },
  {
    id: 'path-param',
    title: 'GET, one path param, no DB',
    method: 'GET',
    path: '/bench/users/42',
    expect: '{"id":"42"}',
  },
  {
    id: 'post-validate',
    title: 'POST, JSON body with schema validation, no DB',
    method: 'POST',
    path: '/bench/echo',
    body: JSON.stringify({ name: 'bench', count: 7 }),
    expect: '{"name":"bench","count":7}',
  },
  {
    id: 'db-roundtrip',
    title: 'GET, full round trip through SQLite',
    method: 'GET',
    path: '/bench/db',
    requiresDb: true,
    expect: '{"id":1,"name":"item-1"}',
  },
]

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find(s => s.id === id)
}
