/**
 * Settings, Appearance: what a viewer picks applies to the page at once and
 * is still there on the next page. Nothing here goes to the server: the
 * choices are kept in this browser (`stacks-dashboard-appearance` in
 * localStorage) and written onto `<html>`, where the shell's CSS reads them.
 *
 * What this does not see: the layout also stamps them before the first paint
 * so a reload never flashes the defaults, and the page's own script applies
 * them again once it loads, which is all a check after load can observe.
 */
import type { Cdp } from '@stacksjs/testing/browser'
import type { DashboardE2E } from './harness'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { click, navigate, waitFor } from '@stacksjs/testing/browser'
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
    await openAppearance(cdp, e2e!.origin)
    // Headless Chrome reports a dark system theme, so System starts dark here
    // and choosing Light is an explicit choice over the system's.
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

  test('a hidden section leaves the sidebar, and comes back', async () => {
    const { cdp } = e2e!.browser
    await openAppearance(cdp, e2e!.origin)
    // The first section the page offers to hide, and its id in the sidebar.
    const label = (await cdp.evaluate<string>(`document.querySelector('input[role="switch"][aria-label^="Show "]')?.getAttribute('aria-label') ?? ''`)).replace(/^Show (.+) section$/, '$1')
    const id = await cdp.evaluate<string | null>(`[...document.querySelectorAll('[data-sidebar-section]')].find(node => node.querySelector('[data-sidebar-section-header]')?.textContent.trim().startsWith(${JSON.stringify(label)}))?.dataset.sectionId ?? null`)
    expect(label).toBeTruthy()
    expect(id).toBeTruthy()
    expect(await sectionShown(cdp, id!)).toBe(true)

    await click(cdp, `label:has(input[role="switch"][aria-label="Show ${label} section"])`)
    await waitFor(async () => !(await sectionShown(cdp, id!)) || null, 5_000, { label: `the ${label} section to leave the sidebar` })

    await navigate(cdp, `${e2e!.origin}/models/team`)
    expect(await sectionShown(cdp, id!)).toBe(false)

    await openAppearance(cdp, e2e!.origin)
    await click(cdp, `label:has(input[role="switch"][aria-label="Show ${label} section"])`)
    await waitFor(async () => await sectionShown(cdp, id!) || null, 5_000, { label: `the ${label} section back in the sidebar` })
  }, 120_000)
})

async function openAppearance(cdp: Cdp, origin: string): Promise<void> {
  await navigate(cdp, `${origin}/settings/appearance`)
  await waitFor(async () => await cdp.evaluate<boolean>(`!!document.querySelector('[aria-label="Color mode"] button') && !!document.querySelector('input[role="switch"]')`) || null, 20_000, { label: 'the appearance settings' })
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
