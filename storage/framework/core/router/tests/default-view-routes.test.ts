/**
 * The default pages served for a bundle post only to routes that bundle
 * mounts (stacksjs/stacks#2237).
 *
 * `resolveViewPatterns` serves `/login` only while the `auth` bundle is
 * mounted and the storefront only while `dashboard` is. That is right exactly
 * when the map in `DEFAULT_VIEW_ROUTE_BUNDLES` is right, so this checks it
 * against the routes each bundle really registers, in both directions: an app
 * mounting the bundle keeps a page whose every endpoint answers, and an app
 * without it would have been serving a page whose endpoints do not.
 *
 * Mounting is read once per process and bootstrap registers into the router
 * singleton, so each selection runs `fixtures/print-bundled-routes.ts` in a
 * fresh subprocess, as default-route-bundles.test.ts does.
 */

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'
import { DEFAULT_VIEW_ROUTE_BUNDLES } from '@stacksjs/config'
import { bundleMounts, DEFAULT_ROUTE_BUNDLE_FEATURES, DEFAULT_ROUTE_BUNDLES, mountedDefaultRouteBundles } from '../src/route-loader'

const projectRoot = join(import.meta.dir, '../../../../..')
const fixture = join(import.meta.dir, 'fixtures/print-bundled-routes.ts')
const defaults = join(projectRoot, 'storage/framework/defaults')
const views = join(defaults, 'resources/views')
const components = join(defaults, 'resources/components/Dashboard/Auth')

async function routesFor(selection: string): Promise<Set<string>> {
  const env: Record<string, string | undefined> = { ...process.env, STACKS_DEFAULT_ROUTES: selection }
  delete env.STACKS_SKIP_DEFAULT_ROUTES

  const proc = Bun.spawn(['bun', fixture], { cwd: projectRoot, env, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  expect(exitCode).toBe(0)
  return new Set(JSON.parse(stdout.trim().split('\n').at(-1)!) as string[])
}

/**
 * What each auth page calls. The pages are thin views over components in
 * `resources/components/Dashboard/Auth`, and the calls are made there, through
 * `useAuth()` or `dashboardApi()`, so they are listed here and each one is
 * checked to still appear in the component that makes it.
 */
const AUTH_PAGE_ENDPOINTS: Record<string, Array<{ route: string, component: string, call: string }>> = {
  'login.stx': [{ route: 'POST /login', component: '../../../../functions/auth.ts', call: '${baseUrl}/login' }],
  'register.stx': [{ route: 'POST /register', component: '../../../../functions/auth.ts', call: '${baseUrl}/register' }],
  'forgot-password.stx': [{ route: 'POST /password/forgot', component: 'ForgotPasswordDashboard.stx', call: '\'/password/forgot\'' }],
  'password/reset/[token].stx': [
    { route: 'POST /password/verify-token', component: 'ResetPasswordDashboard.stx', call: '\'/password/verify-token\'' },
    { route: 'POST /password/reset', component: 'ResetPasswordDashboard.stx', call: '\'/password/reset\'' },
  ],
  'auth/magic/[token].stx': [{ route: 'POST /auth/magic-link/consume', component: 'MagicLink.stx', call: '\'/auth/magic-link/consume\'' }],
}

/** Every `<form action="…" method="POST">` a storefront page posts. */
function storefrontPosts(): Map<string, string[]> {
  const pages = new Map<string, string[]>()
  const visit = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        visit(full)
        continue
      }
      const actions = [...readFileSync(full, 'utf8').matchAll(/action="([^"]+)"\s+method="POST"/g)].map(m => `POST ${m[1]}`)
      pages.set(relative(views, full), actions)
    }
  }
  for (const entry of DEFAULT_VIEW_ROUTE_BUNDLES.dashboard) {
    const full = join(views, entry)
    if (statSync(full).isDirectory())
      visit(full)
    else
      pages.set(entry, [...readFileSync(full, 'utf8').matchAll(/action="([^"]+)"\s+method="POST"/g)].map(m => `POST ${m[1]}`))
  }
  return pages
}

describe('the map from default pages to bundles', () => {
  test('every auth page it lists is accounted for', () => {
    const covered = Object.keys(AUTH_PAGE_ENDPOINTS)
    for (const page of covered) {
      const owner = DEFAULT_VIEW_ROUTE_BUNDLES.auth.some(entry => page === entry || page.startsWith(`${entry}/`))
      expect(owner).toBeTrue()
    }
  })

  test('each listed call is still made where it says', () => {
    for (const calls of Object.values(AUTH_PAGE_ENDPOINTS)) {
      for (const { component, call } of calls)
        expect(readFileSync(join(components, component), 'utf8')).toContain(call)
    }
  })

  test('the storefront pages post somewhere', () => {
    // A regex that silently matched nothing would make the next test vacuous.
    const posts = [...storefrontPosts().values()].flat()
    expect(posts).toContain('POST /api/cart/update')
    expect(posts).toContain('POST /api/checkout/place')
  })
})

describe('a mounted bundle answers every call its pages make', () => {
  test('auth', async () => {
    const [auth, none] = await Promise.all([routesFor('auth'), routesFor('none')])
    for (const calls of Object.values(AUTH_PAGE_ENDPOINTS)) {
      for (const { route } of calls) {
        expect(auth).toContain(route)
        // And without the bundle nothing answers, which is why the page goes.
        expect(none).not.toContain(route)
      }
    }
  }, 120_000)

  test('dashboard carries the storefront', async () => {
    const [dashboard, none, auth] = await Promise.all([routesFor('dashboard'), routesFor('none'), routesFor('auth')])
    for (const [page, posts] of storefrontPosts()) {
      for (const route of posts) {
        expect({ page, route, mounted: dashboard.has(route) }).toEqual({ page, route, mounted: true })
        expect(none.has(route)).toBeFalse()
        expect(auth.has(route)).toBeFalse()
      }
    }
  }, 120_000)
})

describe('mountedDefaultRouteBundles agrees with bootstrap', () => {
  const on = () => true
  const off = () => false

  test('an app that names nothing mounts what its feature flags allow', () => {
    expect(mountedDefaultRouteBundles(on, {})).toEqual(new Set(DEFAULT_ROUTE_BUNDLES))
    expect(mountedDefaultRouteBundles(off, {})).toEqual(new Set())
    expect(mountedDefaultRouteBundles(name => name === 'dashboard', {})).toEqual(new Set(['auth', 'dashboard']))
  })

  test('named bundles mount whatever the flags say', () => {
    expect(mountedDefaultRouteBundles(off, { STACKS_DEFAULT_ROUTES: 'auth' })).toEqual(new Set(['auth']))
    expect(mountedDefaultRouteBundles(on, { STACKS_DEFAULT_ROUTES: 'none' })).toEqual(new Set())
    expect(mountedDefaultRouteBundles(on, { STACKS_SKIP_DEFAULT_ROUTES: '1' })).toEqual(new Set())
  })

  test('the opt-in social bundle is never reported', () => {
    expect(mountedDefaultRouteBundles(on, { STACKS_DEFAULT_ROUTES: 'social,auth' })).toEqual(new Set(['auth']))
  })

  test('every default bundle has a feature flag', () => {
    expect(Object.keys(DEFAULT_ROUTE_BUNDLE_FEATURES).sort()).toEqual([...DEFAULT_ROUTE_BUNDLES].sort())
  })

  test('bootstrap decides with the same function and flags', () => {
    const bootstrap = readFileSync(join(defaults, 'bootstrap.ts'), 'utf8')
    expect(bootstrap).toContain('bundleMounts(selection, bundle, feature(DEFAULT_ROUTE_BUNDLE_FEATURES[bundle]))')
    expect(bundleMounts(undefined, 'auth', true)).toBeTrue()
    expect(bundleMounts({ bundles: new Set(['auth']), explicit: true }, 'auth', false)).toBeTrue()
    expect(bundleMounts({ bundles: new Set(['auth']), explicit: false }, 'dashboard', true)).toBeFalse()
  })
})
