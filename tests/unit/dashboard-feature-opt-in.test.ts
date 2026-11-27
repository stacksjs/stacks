import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DEFAULT_VIEW_ROUTE_BUNDLES } from '../../storage/framework/core/config/src/views'
import { DEFAULT_ROUTE_BUNDLE_FEATURES, mountedDefaultRouteBundles } from '../../storage/framework/core/router/src/route-loader'
import { disabledFeatureConfigs } from '../../storage/framework/core/actions/src/dev/dashboard-feature-views'
import { dashboardPageAvailable, dashboardViewExclusions, unavailableDashboardPages } from '../../storage/framework/defaults/resources/functions/dashboard/page-availability'
import { resolveDashboardToggles } from '../../storage/framework/defaults/resources/functions/dashboard/toggles'

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

  test('the page policy hides uninstalled features even when their sections are explicitly enabled', () => {
    const sections = resolveDashboardToggles({
      sections: { content: { enabled: true }, commerce: { enabled: true }, marketing: { enabled: true } },
    }, () => false)
    const exclusions = dashboardViewExclusions(frameworkDashboard, { sections })
    const paths = ['content', 'commerce', 'analytics/commerce', 'marketing', 'marketing/reviews', 'marketing/abandoned-carts']
    for (const path of paths) {
      expect(exclusions).toContain(join(frameworkDashboard, path))
      expect(existsSync(join(frameworkDashboard, path))).toBe(true)
    }
    expect(exclusions).not.toContain(join(frameworkDashboard, 'analytics'))
  })

  test('a dashboard section can opt out with its feature installed', () => {
    const sections = resolveDashboardToggles({
      sections: { library: { enabled: false }, analytics: { enabled: false }, data: { users: { enabled: false }, allModels: { enabled: false } } },
    }, () => true)
    const exclusions = dashboardViewExclusions(frameworkDashboard, { sections })
    for (const path of ['library', 'analytics', 'data/users.stx', 'data/users', 'models/index.stx'])
      expect(exclusions).toContain(join(frameworkDashboard, path))
    expect(exclusions).not.toContain(join(frameworkDashboard, 'models'))
    expect(exclusions).not.toContain(join(frameworkDashboard, 'commerce'))
    expect(exclusions).not.toContain(join(frameworkDashboard, 'settings'))
  })

  test('page links and file exclusions agree for unavailable schema and provider pages', () => {
    const availability = { schemaModels: ['User'], inbox: false, remote: false }
    const exclusions = dashboardViewExclusions(frameworkDashboard, availability)
    const unavailable = unavailableDashboardPages(availability)
    for (const path of ['/requests', '/notifications/dashboard', '/data/activity', '/settings/billing', '/inbox', '/inbox/activity', '/inbox/settings', '/remote'])
      expect(dashboardPageAvailable(path, unavailable)).toBe(false)
    for (const path of ['requests', 'notifications', 'data/activity', 'settings/billing.stx', 'inbox/index.stx', 'inbox/activity.stx', 'inbox/settings.stx', 'remote'])
      expect(exclusions).toContain(join(frameworkDashboard, path))
    for (const path of ['/data/users', '/inbox/captured', '/models/user', '/settings/appearance'])
      expect(dashboardPageAvailable(path, unavailable)).toBe(true)
  })

  test('mail settings follow the local preferences model when there is no inbox provider', () => {
    const availability = { schemaModels: ['MailPreference'], inbox: false }
    const unavailable = unavailableDashboardPages(availability)
    expect(dashboardPageAvailable('/inbox', unavailable)).toBe(false)
    expect(dashboardPageAvailable('/inbox/activity', unavailable)).toBe(false)
    expect(dashboardPageAvailable('/inbox/settings', unavailable)).toBe(true)
    expect(dashboardViewExclusions(frameworkDashboard, availability)).not.toContain(join(frameworkDashboard, 'inbox/settings.stx'))
  })

  test('analytics and telemetry pages follow their local models or hosted providers', () => {
    const local = unavailableDashboardPages({ schemaModels: ['AnalyticsEvent'] })
    expect(dashboardPageAvailable('/analytics/web', local)).toBe(false)
    expect(dashboardPageAvailable('/analytics/commerce/web', local)).toBe(false)
    expect(dashboardPageAvailable('/analytics/commerce/sales', local)).toBe(true)
    expect(dashboardPageAvailable('/analytics', local)).toBe(false)
    expect(dashboardPageAvailable('/analytics/events', local)).toBe(true)
    expect(dashboardPageAvailable('/analytics/marketing', local)).toBe(false)
    expect(dashboardPageAvailable('/errors', local)).toBe(false)
    expect(dashboardPageAvailable('/logs', local)).toBe(false)

    const providers = { analytics: { driver: 'hq' }, logs: { driver: 'hq' }, errors: { driver: 'hq' } } as const
    const hosted = unavailableDashboardPages({ schemaModels: [], providers })
    for (const path of ['/analytics', '/analytics/web', '/errors', '/logs'])
      expect(dashboardPageAvailable(path, hosted)).toBe(true)

    const sections = resolveDashboardToggles({ sections: { analytics: { enabled: false } } }, () => true)
    const disabled = unavailableDashboardPages({ sections, schemaModels: [] })
    expect(dashboardPageAvailable('/analytics/commerce/web', disabled)).toBe(false)
  })

  test('both dashboard servers use the shared page exclusions', () => {
    for (const file of ['storage/framework/core/actions/src/dev/dashboard.ts', 'storage/framework/core/actions/src/serve/dashboard.ts'])
      expect(readFileSync(resolve(file), 'utf8')).toMatch(/exclude: dashboardViewExclusions\(/)
  })

  test('the home activity card names orders only with commerce on', () => {
    const table = readFileSync(resolve('storage/framework/defaults/resources/components/Dashboard/UI/ActivityTable.stx'), 'utf8')
    const home = readFileSync(resolve('storage/framework/defaults/resources/components/Dashboard/Home/DashboardHome.stx'), 'utf8')
    expect(table).not.toContain('orders')
    expect(home).toContain('dashboard.sections.value.commerce === true')
  })

  test('Settings leaves out the config files of features that are off', () => {
    expect([...disabledFeatureConfigs(() => false)].sort()).toEqual(['cms', 'commerce'])
    expect([...disabledFeatureConfigs(() => true)]).toEqual([])
    expect([...disabledFeatureConfigs(feature => feature === 'cms')]).toEqual(['commerce'])
    // Listed, read, shown as source and written: all four go through the same check.
    const server = readFileSync(resolve('storage/framework/core/actions/src/dev/dashboard.ts'), 'utf8')
    expect(server).toContain('listConfigFiles().filter((file: { name: string }) => !hidden.has(')
    expect(server.match(/\(await hiddenConfigs\(\)\)\.has\(/g)?.length).toBe(3)
  })

  test('the home page filters its links on the server before emitting them', () => {
    const home = readFileSync(resolve('storage/framework/defaults/resources/components/Dashboard/Home/DashboardHome.stx'), 'utf8')
    expect(home).toContain('const isDashboardPageAvailable = dashboardPageVisibility()')
    expect(home).toContain('.filter(link => isDashboardPageAvailable(link.href))')
    expect(home).toContain('@if(showRequestHistory)')
    expect(home).toContain('@if(showActivityLink)')
  })
})
