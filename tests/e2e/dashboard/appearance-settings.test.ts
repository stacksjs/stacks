/**
 * Settings, Appearance: what a viewer picks applies to the page at once and
 * is still there on the next page. Nothing here goes to the server: the
 * choices are kept in this browser and written onto `<html>`, where the
 * shell's CSS reads them.
 *
 * What this does not see: the layout also stamps them before the first paint
 * so a reload never flashes the defaults, and the page's own script applies
 * them again once it loads, which is all a check after load can observe.
 */
import type { Cdp } from '@stacksjs/testing/browser'
import type { DashboardE2E } from './harness'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { click, navigate, waitFor } from '@stacksjs/testing/browser'
import { join } from 'node:path'
import { dashboardE2EAvailable, signIn, startDashboardE2E } from './harness'

describe.skipIf(!dashboardE2EAvailable)('appearance settings', () => {
  let e2e: DashboardE2E | undefined

  beforeAll(async () => {
    e2e = await startDashboardE2E()
    await signIn(e2e)
  }, 180_000)

  afterAll(async () => {
    await e2e?.close()
  })

  test('the sidebar style and color mode apply at once and survive a reload', async () => {
    const { cdp } = e2e!.browser
    // The system theme is set here, not taken from the machine: headless Chrome
    // reported dark on a Mac and light on the Linux CI runner, which failed this
    // there before it checked anything. With the system dark, System starts dark
    // and choosing Light is an explicit choice over the system's.
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
    await openAppearance(cdp, e2e!.origin)
    expect(await root(cdp)).toEqual({ appearance: 'macos', colorMode: 'system', dark: true })

    await click(cdp, 'button[aria-pressed]:has([data-style="arc"])')
    await click(cdp, { selector: '[aria-label="Color mode"] button', text: 'Light' })
    await waitFor(async () => {
      const now = await root(cdp)
      return now.appearance === 'arc' && now.colorMode === 'light' && !now.dark ? now : null
    }, 5_000, { label: 'Arc and Light on the page' })
    expect(await pressed(cdp, 'Arc')).toBe('true')
    expect(await pressed(cdp, 'Light')).toBe('true')

    // Another page, opened fresh, is drawn the same way.
    await navigate(cdp, `${e2e!.origin}/models/team`)
    expect(await root(cdp)).toEqual({ appearance: 'arc', colorMode: 'light', dark: false })
    await openAppearance(cdp, e2e!.origin)
    expect(await pressed(cdp, 'Arc')).toBe('true')
    expect(await pressed(cdp, 'Light')).toBe('true')

    await click(cdp, { selector: 'button', text: 'Reset to defaults' })
    await waitFor(async () => {
      const now = await root(cdp)
      return now.appearance === 'macos' && now.colorMode === 'system' && now.dark ? now : null
    }, 5_000, { label: 'the defaults back on the page' })
  }, 120_000)

  test('The Original uses the chosen color scheme on overview surfaces and sidebar controls', async () => {
    const { cdp } = e2e!.browser
    const origin = e2e!.origin
    for (const { system, mode, panel, field } of [
      { system: 'light', mode: 'Dark', panel: 'rgb(24, 25, 31)', field: 'rgb(37, 39, 46)' },
      { system: 'dark', mode: 'Light', panel: 'rgb(255, 255, 255)', field: 'rgb(255, 255, 255)' },
    ]) {
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: system }] })
      await openAppearance(cdp, origin)
      await click(cdp, { selector: '[aria-label="Color mode"] button', text: mode })
      await navigate(cdp, origin)
      const appearance = await cdp.evaluate(`(() => {
        const panel = document.querySelector('section.overview-panel')
        const sidebar = document.querySelector('[data-stx-sidebar]')
        return {
          colorScheme: getComputedStyle(document.documentElement).colorScheme,
          panel: getComputedStyle(panel).backgroundColor,
          sidebarAccent: getComputedStyle(sidebar).getPropertyValue('--stx-sidebar-accent').trim(),
        }
      })()`)
      expect(appearance).toEqual({
        colorScheme: mode.toLowerCase(),
        panel,
        sidebarAccent: 'light-dark(#0863ce, #216cdf)',
      })
      await navigate(cdp, `${origin}/jobs/history`)
      expect(await cdp.evaluate(`getComputedStyle(document.querySelector('select[data-dashboard-field]')).backgroundColor`)).toBe(field)
      expect(await cdp.evaluate(`Boolean(document.querySelector('main table thead'))`)).toBe(true)
    }
    await openAppearance(cdp, origin)
    await click(cdp, { selector: 'button', text: 'Reset to defaults' })
  }, 120_000)

  test('System Cleaner opens designed section indexes from flat links and home cards', async () => {
    const { cdp } = e2e!.browser
    const origin = e2e!.origin
    await openAppearance(cdp, origin)
    await click(cdp, 'button[data-theme-id="system-cleaner"]')
    await navigate(cdp, origin)
    const appLink = '[data-dashboard-section-sidebar] [href="/sections/app"]'
    const appCard = '[data-dashboard-section-overview] [data-dashboard-navigation-card][href="/sections/app"]'
    await waitFor(() => cdp.evaluate(`!!document.querySelector('${appCard}')`), 5_000)
    expect(await cdp.evaluate(`document.querySelector('${appLink}')?.getClientRects().length`)).toBe(1)
    expect(await cdp.evaluate(`[...document.querySelectorAll('[data-sidebar-section-header], [data-sidebar-disclosure]')].some(element => element.getClientRects().length > 0)`)).toBe(false)

    const metrics = await cdp.evaluate(`(() => {
      const panel = document.querySelector('[data-dashboard-metrics]')
      return { background: getComputedStyle(panel).backgroundColor, border: getComputedStyle(panel).borderTopWidth }
    })()`)
    expect(metrics).toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px' })

    await click(cdp, appLink)
    await waitFor(() => cdp.evaluate(`location.pathname === '/sections/app' && document.querySelector('h1')?.textContent.trim() === 'App'`), 10_000)
    expect(await cdp.evaluate(`document.querySelector('${appLink}')?.getAttribute('aria-current')`)).toBe('page')

    await waitFor(() => cdp.evaluate(`Boolean(document.querySelector('[data-dashboard-section-primary][href="/deployments"]'))`), 10_000)
    expect(await cdp.evaluate(`document.querySelector('.dashboard-section-intro p')?.textContent`)).toContain('Ship changes')
    const appGradient = await cdp.evaluate<string>('getComputedStyle(document.body).backgroundImage')
    expect(appGradient).toContain('gradient')
    await click(cdp, '[data-dashboard-destination][href="/jobs/history"]')
    await waitFor(() => cdp.evaluate(`location.pathname === '/jobs/history' && document.querySelector('${appLink}')?.getAttribute('aria-current') === 'location'`), 10_000)

    await navigate(cdp, origin)
    await click(cdp, appCard)
    await waitFor(() => cdp.evaluate(`location.pathname === '/sections/app' && !!document.querySelector('[data-dashboard-section-primary][href="/deployments"]')`), 10_000)

    await click(cdp, '[data-dashboard-section-sidebar] [href="/sections/data"]')
    await waitFor(() => cdp.evaluate(`location.pathname === '/sections/data' && !!document.querySelector('[data-dashboard-section-primary][href="/models"]')`), 10_000)
    expect(await cdp.evaluate('getComputedStyle(document.body).backgroundImage')).not.toBe(appGradient)

    await openAppearance(cdp, origin)
    await click(cdp, 'button[data-theme-id="original"]')
    await navigate(cdp, origin)
    expect(await cdp.evaluate(`[...document.querySelectorAll('[data-sidebar-section-header')].some(element => element.getClientRects().length > 0)`)).toBe(true)
  }, 120_000)

  test('selects, imports, updates and removes themes across real dashboard pages', async () => {
    const { cdp } = e2e!.browser
    const origin = e2e!.origin

    await openAppearance(cdp, origin)
    const original = 'button[data-theme-id="original"]'
    const cleaner = 'button[data-theme-id="system-cleaner"]'
    await waitFor(() => cdp.evaluate(`!!document.querySelector('${cleaner}')`), 10_000)
    expect(await pressed(cdp, 'The Original')).toBe('true')
    const starterUrl = await cdp.evaluate<string>(`document.querySelector('a[download="my-dashboard.json"]')?.href`)
    expect(starterUrl).toStartWith('data:application/json;')
    const starter = JSON.parse(decodeURIComponent(starterUrl.slice(starterUrl.indexOf(',') + 1)))

    await click(cdp, cleaner)
    await waitFor(() => themeApplied(cdp, 'system-cleaner', 0), 5_000)
    expect(await pressed(cdp, 'System Cleaner')).toBe('true')

    await navigate(cdp, origin)
    expect(await themeApplied(cdp, 'system-cleaner', 14)).toBe(true)
    expect(await cdp.evaluate(`getComputedStyle(document.body).backgroundImage.includes('gradient')`)).toBe(true)

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 840, deviceScaleFactor: 1, mobile: true })
    try {
      expect(await themeApplied(cdp, 'system-cleaner', 0)).toBe(true)
      expect(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true)
      await click(cdp, 'button[aria-label="Open dashboard navigation"]')
      await waitFor(() => cdp.evaluate(`Array.from(document.querySelectorAll('[data-dashboard-mobile-sidebar] [data-dashboard-section-entry]')).some(link => link.getClientRects().length > 0)`), 5_000)
    }
    finally {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    }
    await openAppearance(cdp, origin)

    const imported = {
      ...starter,
      id: 'midnight-sample',
      name: 'Midnight Sample',
      layout: 'flush',
      overview: 'panel',
      light: { ...starter.light, canvas: '#e0dff0' },
      dark: { ...starter.dark, canvas: '#13152b' },
    }
    const manifest = join(e2e!.database.directory, 'dashboard-theme.json')

    await Bun.write(manifest, JSON.stringify({ ...imported, light: { ...imported.light, canvas: 'url(/unknown)' } }))
    await chooseThemeFile(cdp, manifest)
    await waitFor(() => cdp.evaluate(`document.querySelector('[role="alert"]')?.textContent.includes('light.canvas') === true`), 5_000)
    expect(await themeApplied(cdp, 'system-cleaner', 0)).toBe(true)

    await Bun.write(manifest, JSON.stringify(imported))
    await chooseThemeFile(cdp, manifest)
    await waitFor(() => themeApplied(cdp, imported.id, 0), 5_000)
    expect(await pressed(cdp, imported.name)).toBe('true')

    await Bun.write(manifest, JSON.stringify({ ...imported, layout: 'inset', radius: 18 }))
    await chooseThemeFile(cdp, manifest)
    await waitFor(() => themeApplied(cdp, imported.id, 0), 5_000)
    expect(await cdp.evaluate(`document.querySelectorAll('button[data-theme-id="${imported.id}"]').length`)).toBe(1)

    await click(cdp, { selector: '[aria-label="Color mode"] button', text: 'Dark' })
    await navigate(cdp, origin)
    expect(await themeApplied(cdp, imported.id, 18)).toBe(true)
    expect(await cdp.evaluate(`getComputedStyle(document.querySelector('[data-dashboard-content]')).backgroundColor`)).toBe('rgb(19, 21, 43)')
    expect(await cdp.evaluate(`getComputedStyle(document.querySelector('[data-dashboard-hero]')).backgroundImage.includes('gradient')`)).toBe(true)

    await openAppearance(cdp, origin)
    await click(cdp, { selector: 'button', text: 'Remove theme' })
    await waitFor(() => themeApplied(cdp, 'original', 0), 5_000)
    expect(await cdp.evaluate(`document.querySelector('${original}')?.getAttribute('aria-pressed')`)).toBe('true')
    expect(await cdp.evaluate(`document.querySelector('button[data-theme-id="${imported.id}"]')`)).toBeNull()
    await click(cdp, { selector: 'button', text: 'Reset to defaults' })
  }, 120_000)

  test('the Settings panes use the same native-style layout in both themes', async () => {
    const { cdp } = e2e!.browser
    const { origin } = e2e!
    await openAppearance(cdp, origin)
    await click(cdp, { selector: '[aria-label="Color mode"] button', text: 'Light' })
    const original = await settingsStyle(cdp)
    await click(cdp, 'button[data-theme-id="system-cleaner"]')
    await waitFor(() => themeApplied(cdp, 'system-cleaner', 0), 5_000)
    expect(await settingsStyle(cdp)).toEqual(original)

    await click(cdp, { selector: '[aria-label="Color mode"] button', text: 'Dark' })
    const cleanerDark = await settingsStyle(cdp)
    expect(cleanerDark).not.toEqual(original)
    await click(cdp, 'button[data-theme-id="original"]')
    await waitFor(() => themeApplied(cdp, 'original', 0), 5_000)
    expect(await settingsStyle(cdp)).toEqual(cleanerDark)

    for (const pane of ['mail', 'billing']) {
      const link = `[aria-label="Settings"] a[href="/settings/${pane}"]`
      await click(cdp, link)
      await waitFor(() => cdp.evaluate(`document.querySelector('${link}')?.getAttribute('aria-current') === 'page' && !!document.querySelector('[data-settings-section]')`), 10_000)
    }

    await openAppearance(cdp, origin)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 840, deviceScaleFactor: 1, mobile: true })
    try {
      expect(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true)
      expect(await cdp.evaluate(`document.querySelector('[aria-label="Settings"] [aria-current="page"]')?.getClientRects().length`)).toBe(1)
    }
    finally {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    }
    await click(cdp, { selector: 'button', text: 'Reset to defaults' })
  }, 120_000)

  test('a hidden section leaves the sidebar, and comes back', async () => {
    const { cdp } = e2e!.browser
    const { origin } = e2e!
    await navigate(cdp, origin)
    await waitFor(async () => await sectionShown(cdp, 'app') || null, 5_000, { label: 'the App section in the sidebar' })

    const toggle = 'button[role="switch"][aria-label="Show App section"]'
    await openAppearance(cdp, origin)
    await click(cdp, toggle)
    await waitFor(() => cdp.evaluate(`document.querySelector('${toggle}')?.getAttribute('aria-checked') === 'false'`), 5_000)
    await navigate(cdp, `${origin}/models/team`)
    expect(await sectionShown(cdp, 'app')).toBe(false)

    await openAppearance(cdp, origin)
    await click(cdp, toggle)
    await waitFor(() => cdp.evaluate(`document.querySelector('${toggle}')?.getAttribute('aria-checked') === 'true'`), 5_000)
    await navigate(cdp, origin)
    await waitFor(async () => await sectionShown(cdp, 'app') || null, 5_000, { label: 'the App section back in the sidebar' })
  }, 120_000)
})

async function openAppearance(cdp: Cdp, origin: string): Promise<void> {
  await navigate(cdp, `${origin}/settings/appearance`)
  await waitFor(async () => await cdp.evaluate<boolean>(`!!document.querySelector('[aria-label="Color mode"] button') && !!document.querySelector('button[role="switch"][aria-label^="Show "]')`) || null, 20_000, { label: 'the appearance settings' })
}

async function settingsStyle(cdp: Cdp): Promise<string[]> {
  return await cdp.evaluate(`['.dashboard-settings-sidebar', '.dashboard-settings-pane', '[data-settings-pane-header]', '.stx-settings-card'].map(selector => {
    const style = getComputedStyle(document.querySelector(selector))
    return [style.backgroundColor, style.color, style.borderRadius].join(' ')
  })`)
}

/** What `<html>` says about the page's look. */
async function root(cdp: Cdp): Promise<{ appearance: string, colorMode: string, dark: boolean }> {
  return await cdp.evaluate(`({ appearance: document.documentElement.dataset.appearance ?? '', colorMode: document.documentElement.dataset.colorMode ?? '', dark: document.documentElement.classList.contains('dark') })`)
}

/** `aria-pressed` on the settings button for `label`: a style card names it first, a color mode only. */
async function pressed(cdp: Cdp, label: string): Promise<string | null> {
  return await cdp.evaluate(`[...document.querySelectorAll('button[aria-pressed]')].find(button => button.textContent.trim().startsWith(${JSON.stringify(label)}))?.getAttribute('aria-pressed') ?? null`)
}

/** Whether the sidebar section with this id is on screen. */
async function sectionShown(cdp: Cdp, id: string): Promise<boolean> {
  return await cdp.evaluate(`(() => {
    const node = document.querySelector('[data-sidebar-section][data-section-id=' + JSON.stringify(${JSON.stringify(id)}) + ']')
    return !!node && node.getClientRects().length > 0
  })()`)
}

async function chooseThemeFile(cdp: Cdp, path: string): Promise<void> {
  const { root } = await cdp.send('DOM.getDocument') as { root: { nodeId: number } }
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: 'input[type="file"][accept=".json,application/json"]',
  }) as { nodeId: number }
  expect(nodeId).toBeGreaterThan(0)
  await cdp.send('DOM.setFileInputFiles', { nodeId, files: [path] })
}

async function themeApplied(cdp: Cdp, id: string, radius: number): Promise<boolean> {
  return await cdp.evaluate(`document.documentElement.dataset.dashboardTheme === ${JSON.stringify(id)}
    && getComputedStyle(document.querySelector('[data-dashboard-content]')).borderTopLeftRadius === '${radius}px'`)
}
