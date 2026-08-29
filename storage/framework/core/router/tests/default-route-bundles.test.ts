/**
 * stacksjs/stacks#2229 — framework default routes were gated by one boolean
 * over one 724-line file.
 *
 * `defaults/routes/dashboard.ts` bundled auth, password reset, 2FA, email
 * subscribe, storefront cart/checkout, reviews, sitemap, AI, voice and the
 * admin dashboard's REST surface together, behind a single
 * `feature('dashboard')`. An app that wanted `/login`, `/register` and 2FA but
 * ships no `Product` or `Coupon` had two options: mount the commerce demo
 * surface, or set `STACKS_SKIP_DEFAULT_ROUTES=1` and re-declare the auth
 * routes by hand with the rate limits copied out of framework source.
 *
 * The reporting app took the second and re-declared nine routes. It also
 * permanently gave up 2FA, sign-out-everywhere and API token management,
 * because re-registering those was not worth the maintenance — shipped
 * framework features it simply could not reach.
 *
 * Two properties are load-bearing here and both are tested below:
 *
 *   1. `STACKS_DEFAULT_ROUTES=auth` mounts the auth surface and nothing else.
 *   2. An app that says nothing gets EXACTLY what it got before. This is the
 *      one that would be expensive to get wrong, because the failure mode is
 *      silently changing which endpoints an existing deployment exposes.
 *
 * Selection is read once per process and bootstrap registers into the router
 * singleton as an import side effect, so each scenario runs the
 * fixtures/print-bundled-routes.ts fixture in a fresh subprocess. The pure
 * resolver is unit-tested directly.
 */

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'
import {
  DEFAULT_ROUTE_BUNDLES,
  OPT_IN_ROUTE_BUNDLES,
  resolveDefaultRouteBundles,
  resolveDefaultRouteBundlesWithDiagnostics,
} from '../src/route-loader'

const projectRoot = join(import.meta.dir, '../../../../..')
const fixture = join(import.meta.dir, 'fixtures/print-bundled-routes.ts')

async function routesFor(vars: Record<string, string | undefined>): Promise<Set<string>> {
  const env: Record<string, string | undefined> = { ...process.env }
  // Scrub inherited values so each scenario controls the gate's input.
  delete env.STACKS_DEFAULT_ROUTES
  delete env.STACKS_SKIP_DEFAULT_ROUTES
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined)
      delete env[key]
    else
      env[key] = value
  }

  const proc = Bun.spawn(['bun', fixture], { cwd: projectRoot, env, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ])
  expect(exitCode).toBe(0)

  // The fixture prints one JSON line last; env-loader chatter precedes it.
  const line = stdout.trim().split('\n').at(-1)!
  return new Set(JSON.parse(line) as string[])
}

// The endpoints the reporting app named as permanently lost.
const AUTH_ROUTES = [
  'POST /login',
  'POST /register',
  'POST /logout-all',
  'POST /generate-two-factor-secret',
  'POST /password/forgot',
  'GET /auth/tokens',
]

describe('resolveDefaultRouteBundles (#2229)', () => {
  test('an app that says nothing gets every bundle', () => {
    expect(resolveDefaultRouteBundles({})).toEqual(new Set(DEFAULT_ROUTE_BUNDLES))
  })

  // Opt-in bundles (#2276): recognized when named, part of neither the
  // implicit default nor `all` — both are what an app that said nothing gets,
  // and OAuth callback URLs in an app with no provider are surface for
  // nothing. (bootstrap.ts additionally mounts `social` on its own when a
  // provider is configured; that gate lives there, not in this resolver.)
  test('opt-in bundles mount when named and never by default', () => {
    for (const name of OPT_IN_ROUTE_BUNDLES) {
      expect(resolveDefaultRouteBundles({})).not.toContain(name)
      expect(resolveDefaultRouteBundles({ STACKS_DEFAULT_ROUTES: 'all' })).not.toContain(name)

      const named = resolveDefaultRouteBundlesWithDiagnostics({ STACKS_DEFAULT_ROUTES: name })
      expect(named.bundles).toEqual(new Set([name]))
      expect(named.unknown).toEqual([])
    }

    expect(resolveDefaultRouteBundles({ STACKS_DEFAULT_ROUTES: 'auth,social' }))
      .toEqual(new Set(['auth', 'social']))
  })

  test('the legacy STACKS_SKIP_DEFAULT_ROUTES=1 still means none', () => {
    expect(resolveDefaultRouteBundles({ STACKS_SKIP_DEFAULT_ROUTES: '1' })).toEqual(new Set())
  })

  test('only "1" ever meant anything for the legacy switch', () => {
    // `=0`, `=true`, `=false` were never honoured; keeping that exact
    // behaviour matters more than making them consistent, because an app
    // relying on `=0` meaning "off" would lose its routes on upgrade.
    for (const value of ['0', 'true', 'false', ''])
      expect(resolveDefaultRouteBundles({ STACKS_SKIP_DEFAULT_ROUTES: value }).size).toBe(DEFAULT_ROUTE_BUNDLES.length)
  })

  test('names the bundles it is given', () => {
    expect(resolveDefaultRouteBundles({ STACKS_DEFAULT_ROUTES: 'auth' })).toEqual(new Set(['auth']))
    expect(resolveDefaultRouteBundles({ STACKS_DEFAULT_ROUTES: 'auth,email' })).toEqual(new Set(['auth', 'email']))
  })

  test('tolerates whitespace, case and empty entries', () => {
    expect(resolveDefaultRouteBundles({ STACKS_DEFAULT_ROUTES: ' Auth , ,EMAIL ' })).toEqual(new Set(['auth', 'email']))
  })

  test('"none" and "all" are spellings of the two extremes', () => {
    expect(resolveDefaultRouteBundles({ STACKS_DEFAULT_ROUTES: 'none' })).toEqual(new Set())
    expect(resolveDefaultRouteBundles({ STACKS_DEFAULT_ROUTES: '' })).toEqual(new Set())
    expect(resolveDefaultRouteBundles({ STACKS_DEFAULT_ROUTES: 'all' })).toEqual(new Set(DEFAULT_ROUTE_BUNDLES))
  })

  test('the new variable wins over the legacy one', () => {
    expect(resolveDefaultRouteBundles({
      STACKS_DEFAULT_ROUTES: 'auth',
      STACKS_SKIP_DEFAULT_ROUTES: '1',
    })).toEqual(new Set(['auth']))
  })

  test('an unknown name costs you that bundle, not the boot', () => {
    const { bundles, unknown } = resolveDefaultRouteBundlesWithDiagnostics({ STACKS_DEFAULT_ROUTES: 'auth,commerce' })
    expect(bundles).toEqual(new Set(['auth']))
    expect(unknown).toEqual(['commerce'])
  })

  test('reports whether the app named bundles at all', () => {
    // `explicit` decides whether the feature flags get a second veto. Naming
    // `auth` has to mount auth even with `dashboard` off, or the whole point
    // is lost.
    expect(resolveDefaultRouteBundlesWithDiagnostics({}).explicit).toBe(false)
    expect(resolveDefaultRouteBundlesWithDiagnostics({ STACKS_DEFAULT_ROUTES: 'auth' }).explicit).toBe(true)
    expect(resolveDefaultRouteBundlesWithDiagnostics({ STACKS_SKIP_DEFAULT_ROUTES: '1' }).explicit).toBe(true)
  })
})

describe('mounted routes per bundle (#2229)', () => {
  test('an app that says nothing mounts the default bundles but not opt-in bundles', async () => {
    const [unset, all] = await Promise.all([routesFor({}), routesFor({ STACKS_DEFAULT_ROUTES: 'all' })])

    expect(unset).not.toEqual(all)
    for (const route of AUTH_ROUTES)
      expect(unset).toContain(route)

    expect(unset).not.toContain('POST /api/forms/{uuid}/submissions')
    expect(all).toContain('POST /api/forms/{uuid}/submissions')
  }, 120_000)

  test('the legacy switch still mounts nothing', async () => {
    const [legacy, none] = await Promise.all([
      routesFor({ STACKS_SKIP_DEFAULT_ROUTES: '1' }),
      routesFor({ STACKS_DEFAULT_ROUTES: 'none' }),
    ])

    expect(legacy).toEqual(none)
    for (const route of AUTH_ROUTES)
      expect(legacy).not.toContain(route)
  }, 120_000)

  test('auth mounts the auth surface without the rest', async () => {
    const [auth, none, all] = await Promise.all([
      routesFor({ STACKS_DEFAULT_ROUTES: 'auth' }),
      routesFor({ STACKS_DEFAULT_ROUTES: 'none' }),
      routesFor({ STACKS_DEFAULT_ROUTES: 'all' }),
    ])

    // Everything the reporter lost is reachable again.
    for (const route of AUTH_ROUTES)
      expect(auth).toContain(route)

    // And none of the demo surface came with it.
    for (const route of ['POST /ai/ask', 'GET /api/analytics/commerce'])
      expect(auth).not.toContain(route)

    // `auth` sits strictly between the two extremes.
    expect(auth.size).toBeGreaterThan(none.size)
    expect(auth.size).toBeLessThan(all.size)
    for (const route of none)
      expect(auth).toContain(route)
  }, 180_000)

  test('bundles compose', async () => {
    const [auth, authEmail] = await Promise.all([
      routesFor({ STACKS_DEFAULT_ROUTES: 'auth' }),
      routesFor({ STACKS_DEFAULT_ROUTES: 'auth,email' }),
    ])

    for (const route of auth)
      expect(authEmail).toContain(route)
    expect(authEmail).toContain('POST /webhooks/email/ses')
    expect(auth).not.toContain('POST /webhooks/email/ses')
  }, 120_000)

  /**
   * Every bundle bootstrap mounts has to be a name the resolver knows.
   *
   * `mounts()` returns false for a bundle missing from `DEFAULT_ROUTE_BUNDLES`,
   * so a routes file added to bootstrap without its name being registered here
   * is silently never mounted: no error, no warning, just endpoints that 404 in
   * every app. That is exactly how `delivery` shipped unmounted.
   */
  test('every bundle bootstrap mounts is a known bundle name', async () => {
    const bootstrap = await Bun.file(join(projectRoot, 'storage/framework/defaults/bootstrap.ts')).text()
    const mounted = [...bootstrap.matchAll(/mounts\(\s*'([\w-]+)'/g)].map(m => m[1])

    expect(mounted.length).toBeGreaterThan(0)

    const known = new Set<string>([...DEFAULT_ROUTE_BUNDLES, ...OPT_IN_ROUTE_BUNDLES])
    for (const name of mounted)
      expect(known).toContain(name)
  })
})
