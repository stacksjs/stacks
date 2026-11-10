import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DEFAULT_VIEW_ROUTE_BUNDLES } from '../../storage/framework/core/config/src/views'
import { DEFAULT_ROUTE_BUNDLE_FEATURES, mountedDefaultRouteBundles } from '../../storage/framework/core/router/src/route-loader'
import { disabledFeatureViews, FEATURE_DASHBOARD_VIEWS } from '../../storage/framework/core/actions/src/dev/dashboard-feature-views'

/**
 * CMS and commerce are opt-in: off until `./buddy cms:install` or
 * `./buddy commerce:install`, and off means absent everywhere - not in the
 * sidebar, not at a typed URL, not as a mounted route.
 */

const frameworkDashboard = resolve('storage/framework/defaults/views/dashboard')

const GATED = /^\/(?:cms|api\/commerce|dashboard\/(?:commerce|cms)|api\/cart|api\/checkout|api\/reviews\/submit|api\/analytics\/(?:sales|commerce))(?:\/|$)/

function registeredPaths(mode: 'on' | 'off'): string[] {
  const result = Bun.spawnSync([process.execPath, resolve('tests/unit/fixtures/feature-gated-routes.ts'), mode], {
    cwd: resolve('.'),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = result.stdout.toString().trim().split('\n').filter(line => line.startsWith('['))
  if (result.exitCode !== 0 || out.length === 0)
    throw new Error(`route fixture failed (${result.exitCode}): ${result.stderr.toString()}`)
  return JSON.parse(out.at(-1)!) as string[]
}

describe('CMS and commerce are off until installed', () => {
  test('the app ships both disabled', async () => {
    expect((await import('../../config/cms')).default.enabled).toBe(false)
    expect((await import('../../config/commerce')).default.enabled).toBe(false)
  })

  test('their routes are not mounted while off, and are once on', () => {
    const off = registeredPaths('off')
    expect(off.length).toBeGreaterThan(0)
    expect(off.filter(path => GATED.test(path))).toEqual([])

    const on = registeredPaths('on')
    for (const path of ['/cms/posts', '/api/commerce/dashboard', '/dashboard/cms/posts', '/dashboard/commerce/orders', '/api/analytics/sales', '/api/analytics/commerce'])
      expect(on).toContain(path)
    // Ungated neighbours stay put either way.
    for (const path of ['/api/analytics/web', '/api/analytics/blog'])
      expect(off).toContain(path)
  }, 60_000)

  test('the storefront is its own bundle, riding on commerce, with its pages', () => {
    // The cart and checkout lived in the dashboard bundle, so every app with a
    // dashboard mounted them and served `/cart` and `/checkout`.
    expect(DEFAULT_ROUTE_BUNDLE_FEATURES.storefront).toBe('commerce')
    expect(DEFAULT_VIEW_ROUTE_BUNDLES.storefront).toEqual(['cart.stx', 'checkout', 'orders'])
    expect(DEFAULT_VIEW_ROUTE_BUNDLES.dashboard).not.toContain('cart.stx')
    expect(mountedDefaultRouteBundles(name => name === 'dashboard', {}).has('storefront')).toBe(false)
    expect(mountedDefaultRouteBundles(name => name === 'dashboard' || name === 'commerce', {}).has('storefront')).toBe(true)
  })

  test('their framework pages are left out of serving while off', () => {
    const off = disabledFeatureViews(frameworkDashboard, () => false)
    expect(off).toContain(join(frameworkDashboard, 'content'))
    expect(off).toContain(join(frameworkDashboard, 'commerce'))
    expect(off).toContain(join(frameworkDashboard, 'analytics/commerce'))
    // A listed directory that no longer exists would gate nothing.
    for (const dir of off)
      expect(existsSync(dir)).toBe(true)

    expect(disabledFeatureViews(frameworkDashboard, () => true)).toEqual([])
    expect(disabledFeatureViews(frameworkDashboard, feature => feature === 'cms'))
      .toEqual(FEATURE_DASHBOARD_VIEWS.commerce.map(relative => join(frameworkDashboard, relative)))
  })

  test('both dashboard servers exclude them', () => {
    for (const file of ['storage/framework/core/actions/src/dev/dashboard.ts', 'storage/framework/core/actions/src/serve/dashboard.ts'])
      expect(readFileSync(resolve(file), 'utf8')).toMatch(/exclude: disabledFeatureViews\(/)
  })

  test('the home activity card names orders only with commerce on', () => {
    const table = readFileSync(resolve('storage/framework/defaults/resources/components/Dashboard/UI/ActivityTable.stx'), 'utf8')
    const home = readFileSync(resolve('storage/framework/defaults/resources/components/Dashboard/Home/DashboardHome.stx'), 'utf8')
    expect(table).not.toContain('orders')
    expect(home).toContain('dashboard.sections.value.commerce === true')
  })

  test('the not-found page does not link into a gated section', () => {
    const notFound = readFileSync(resolve('storage/framework/defaults/resources/components/Dashboard/NotFoundDashboard.stx'), 'utf8')
    const gated = Object.values(FEATURE_DASHBOARD_VIEWS).flat()
    for (const match of notFound.matchAll(/\bto="(\/[^"]*)"/g))
      expect(gated.some(relative => match[1] === `/${relative}` || match[1].startsWith(`/${relative}/`))).toBe(false)
  })
})
