/**
 * What gets measured, and under which profile.
 *
 * `cookie: true` makes the load generator echo a CSRF cookie on every request,
 * which is what a browser does from its second request onward. Without it the
 * run measures a cold first visit repeated for thirty seconds, and Stacks mints
 * a render token every time. Both are real; the README says which row is which.
 */

export interface Target {
  id: string
  label: string
  /** File under `servers/`. */
  server: string
  env?: Record<string, string>
  /** Send the CSRF cookie a returning client would have. */
  cookie?: boolean
  /** Absent from this repo's dependencies; skipped rather than failed. */
  optional?: boolean
}

export const TARGETS: readonly Target[] = [
  {
    id: 'stacks',
    label: 'Stacks (stock defaults, cold client)',
    server: 'stacks.ts',
  },
  {
    id: 'stacks-warm',
    label: 'Stacks (stock defaults, client echoes CSRF cookie)',
    server: 'stacks.ts',
    cookie: true,
  },
  {
    id: 'stacks-minimal',
    label: 'Stacks (security headers off, route skipCsrf)',
    server: 'stacks.ts',
    env: { BENCH_MODE: 'minimal', STACKS_SECURITY_HEADERS_DISABLE: 'true' },
    cookie: true,
  },
  {
    id: 'elysia',
    label: 'Elysia',
    server: 'elysia.ts',
    optional: true,
  },
  {
    id: 'hono',
    label: 'Hono',
    server: 'hono.ts',
    optional: true,
  },
  {
    id: 'bun-raw',
    label: 'Bun.serve baseline',
    server: 'bun-raw.ts',
  },
]

export function targetById(id: string): Target | undefined {
  return TARGETS.find(t => t.id === id)
}
