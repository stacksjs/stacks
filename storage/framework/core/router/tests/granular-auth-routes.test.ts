/**
 * Auth is its own default route bundle (stacksjs/stacks#2229).
 *
 * `defaults/routes/dashboard.ts` bundled login, registration, passkeys, 2FA,
 * token management and password reset together with the commerce/cms/ai/admin
 * surface, gated only by `feature('dashboard')`. An app that wanted `/login`
 * and 2FA but not `Product`/`Coupon` had to either activate the whole dashboard
 * or re-declare the auth routes by hand (and copy their rate limits out of
 * framework source). Auth now lives in `defaults/routes/auth.ts`, gated by
 * `feature('auth') || feature('dashboard')` in bootstrap.ts.
 *
 * Importing a routes file registers into the router singleton as a side effect,
 * and `bun test` shares one process across files, so each file is snapshotted in
 * a fresh subprocess via fixtures/print-routes-for.ts.
 */

import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, test } from 'bun:test'

const projectRoot = join(import.meta.dir, '../../../../..')
const fixture = join(import.meta.dir, 'fixtures/print-routes-for.ts')

async function routesForFile(name: string): Promise<string[]> {
  const proc = Bun.spawn(['bun', fixture, name], {
    cwd: projectRoot,
    env: { ...process.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ])
  expect(exitCode).toBe(0)
  // The preloader may chat on stdout first — the snapshot is the last line.
  const lines = stdout.trim().split('\n')
  return JSON.parse(lines[lines.length - 1]) as string[]
}

const AUTH_ROUTES = [
  'POST /login',
  'POST /register',
  'POST /verify-two-factor-login',
  'POST /generate-two-factor-secret',
  'GET /generate-registration-options',
  'POST /auth/refresh',
  'GET /auth/tokens',
  'GET /me',
  'POST /logout',
  'POST /logout-all',
  'POST /password/forgot',
  'POST /password/reset',
]

describe('granular auth route bundle (#2229)', () => {
  test('auth.ts registers the whole auth surface on its own', async () => {
    const routes = await routesForFile('auth')
    for (const r of AUTH_ROUTES)
      expect(routes).toContain(r)
  }, 30000)

  test('dashboard.ts no longer registers any auth route — they moved out', async () => {
    const routes = await routesForFile('dashboard')
    for (const r of AUTH_ROUTES)
      expect(routes).not.toContain(r)
  }, 30000)

  test('dashboard.ts still registers its own surface (the split removed only auth)', async () => {
    // A commerce route proves the file loaded and kept everything that is not
    // auth — the extraction must not have taken a neighbour with it.
    const routes = await routesForFile('dashboard')
    expect(routes).toContain('POST /api/cart/add')
  }, 30000)
})
