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
 * The CSRF token the client echoes, and the cookie carrying it.
 *
 * Two uses. On safe methods it marks the "warm client" profile: a browser has
 * the cookie from its first response onward, so every request after that one
 * carries it, and a generator that never sends one is measuring a cold first
 * visit repeated a million times rather than the traffic anybody serves.
 *
 * On unsafe methods every profile sends it, because that is what the
 * double-submit pattern requires - a client with no token cannot POST through
 * a CSRF gate at all, so without this scenario 3 measures a 403.
 */
export const CSRF_TOKEN = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
export const CSRF_COOKIE = `X-CSRF-Token=${CSRF_TOKEN}`

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
