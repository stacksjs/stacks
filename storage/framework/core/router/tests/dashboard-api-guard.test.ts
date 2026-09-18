/**
 * The `/api/dashboard/*` surface carries the framework's most privileged
 * endpoints: reading and rewriting the project `.env`, writing the deploy
 * script, syncing RBAC roles, and generic model-row CRUD. `guard()` attaches
 * `auth` + `role:admin` to them everywhere except a local deployment.
 *
 * It used to decide that from the environment NAME, treating `development` as
 * local - and `.env.example` ships `APP_ENV=development`, so an app that never
 * edited that line served all of it unauthenticated. Same failure the auth
 * cookie had in stacksjs/stacks#2275, which is why the decision now comes from
 * the app URL.
 */

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'

const projectRoot = join(import.meta.dir, '../../../../..')
const fixture = join(import.meta.dir, 'fixtures/print-dashboard-api-guards.ts')

/** A route that must never be reachable without credentials off localhost. */
const PRIVILEGED = 'GET /api/dashboard/environment'

async function guardsFor(overrides: { APP_ENV?: string, APP_URL?: string }): Promise<Map<string, string[]>> {
  const env: Record<string, string | undefined> = { ...process.env }
  delete env.APP_ENV
  delete env.NODE_ENV
  delete env.APP_URL
  Object.assign(env, overrides)

  const proc = Bun.spawn(['bun', fixture], { cwd: projectRoot, env, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  expect(exitCode, `${stdout}\n${stderr}`).toBe(0)

  const lines = stdout.trim().split('\n')
  const rows = JSON.parse(lines[lines.length - 1]) as Array<{ route: string, middleware: string[] }>
  return new Map(rows.map(row => [row.route, row.middleware]))
}

describe('dashboard API guard', () => {
  test('a public URL is guarded even when the environment calls itself development', async () => {
    const guards = await guardsFor({ APP_ENV: 'development', APP_URL: 'https://app.example.com' })

    expect(guards.has(PRIVILEGED), 'the environment endpoint must be registered').toBe(true)
    expect(guards.get(PRIVILEGED)).toContain('auth')
    expect(guards.get(PRIVILEGED)).toContain('role:admin')
  }, 30_000)

  test('every registered dashboard API route is guarded off localhost', async () => {
    const guards = await guardsFor({ APP_ENV: 'production', APP_URL: 'https://app.example.com' })

    const unguarded = [...guards]
      .filter(([route]) => route.includes('/api/dashboard/'))
      .filter(([, middleware]) => !middleware.includes('auth'))
      .map(([route]) => route)

    // `/auth/me` is intentionally anonymous (#1843): the dashboard asks who
    // you are before it can know whether to send you to a login, and the
    // action answers unauthenticated requests with a soft-fallback shape.
    expect(unguarded.filter(route => !route.endsWith('/api/dashboard/auth/me'))).toEqual([])
  }, 30_000)

  test('a loopback URL keeps the dashboard open for local development', async () => {
    const guards = await guardsFor({ APP_ENV: 'development', APP_URL: 'stacks.localhost' })

    expect(guards.get(PRIVILEGED)).toEqual([])
  }, 30_000)
})
