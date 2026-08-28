import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const layoutSource = readFileSync(
  resolve('storage/framework/defaults/views/dashboard/layouts/default.stx'),
  'utf8',
)
const guestLayoutSource = readFileSync(
  resolve('storage/framework/defaults/views/dashboard/layouts/guest.stx'),
  'utf8',
)
const notFoundSource = readFileSync(
  resolve('storage/framework/defaults/resources/components/Dashboard/NotFoundDashboard.stx'),
  'utf8',
)

/** STX expands this declarative contract into the synchronous pre-paint guard. */
const BOOTSTRAP = /@appearanceBootstrap\(\{[\s\S]*?\n\}\)/
const bootstrap = layoutSource.match(BOOTSTRAP)?.[0] ?? ''

describe('dashboard layout client architecture', () => {
  test('gives guest pages a semantic SPA navigation container', () => {
    expect(guestLayoutSource).toStartWith('<!DOCTYPE html>')
    expect(guestLayoutSource).toContain('<main data-stx-content>')
    expect(guestLayoutSource).toContain('@yield(\'content\')')
  })

  test('leaves the traffic lights to the platform', () => {
    // The window's buttons are AppKit's in every Craft window that is not
    // frameless. The sidebar header draws none and reserves whatever room the
    // host says they need — which is nothing in a browser, and nothing in a
    // window that keeps them in a titlebar of their own.
    expect(layoutSource).toContain('<SidebarHeader windowControls="native" />')
    // The mobile drawer is not the window edge; no buttons land on it.
    expect(layoutSource).toContain('<SidebarHeader windowControls="none" />')
    expect(layoutSource).not.toContain('showWindowControls')
  })

  test('returns missing dashboard routes to the canonical home route', () => {
    expect(notFoundSource).toContain('<Button tag="a" href="/">')
    expect(notFoundSource).toContain('<StxLink to="/"')
    expect(notFoundSource).not.toContain('href="/dashboard"')
    expect(notFoundSource).not.toContain('to="/dashboard"')
  })

  test('declares light and dark dashboard favicons in both shells', () => {
    for (const source of [layoutSource, guestLayoutSource]) {
      expect(source).toContain('href="/images/logos/favicon.svg"')
      expect(source).toContain('href="/images/logos/favicon-dark.svg"')
      expect(source).toContain('media="(prefers-color-scheme: dark)"')
    }
  })

  test('uses STX lifecycle and component events for sidebar navigation', () => {
    expect(layoutSource).toContain('useRef(\'dashboardSidebarHost\')')
    expect(layoutSource).toContain('useEventListener(\'stx:navigate\'')
    expect(layoutSource).toContain('onMount(() =>')
    expect(layoutSource).toContain('@itemClick="handleSidebarItemClick($event)"')
    expect(layoutSource).toContain('ensureCraftNativeSidebarMarker()')
    expect(layoutSource).toContain('data-dashboard-web-sidebar')
  })

  test('contains wide page content inside the dashboard shell', () => {
    expect(layoutSource).toMatch(/\[data-stx-content\] \{[\s\S]*?overflow-x: hidden;/)
  })

  test('does not carry the legacy raw browser wiring', () => {
    expect(layoutSource.match(/^<script\b[^>]*>$/gm)).toEqual([
      '<script server>',
      '<script client>',
    ])
    expect(layoutSource).not.toContain('document.')
    expect(layoutSource).not.toContain('window.')
    expect(layoutSource).not.toMatch(/\bvar\s+/)
    expect(layoutSource).not.toContain('__sidebarWired')
    expect(layoutSource).toContain('i-hugeicons-cancel-01')
    expect(layoutSource).not.toContain('<svg')
  })

  test('uses the native STX pre-paint appearance contract', () => {
    expect(bootstrap).not.toBe('')
    expect(layoutSource.indexOf(bootstrap)).toBeLessThan(layoutSource.indexOf('<style>'))
    expect(bootstrap).toContain('stacks-dashboard-appearance')
    expect(bootstrap).toContain("key: 'sidebarStyle'")
    expect(bootstrap).toContain("attribute: 'appearance'")
    expect(bootstrap).toContain("allowed: ['macos', 'arc']")
    expect(bootstrap).toContain("default: 'macos'")
    expect(bootstrap).toContain("key: 'colorMode'")
    expect(bootstrap).toContain("attribute: 'color-mode'")
    expect(bootstrap).toContain("default: 'system'")
  })

  test('bridges appearance navigation metadata into the client controller explicitly', () => {
    const appearance = readFileSync(
      resolve('storage/framework/defaults/resources/components/Dashboard/Settings/AppearanceSettingsDashboard.stx'),
      'utf8',
    )

    expect(appearance).toContain('export const navSections = buildWebSidebarSections()')
    expect(appearance).toContain('const sections = {{ navSections }}')
    expect(appearance).not.toContain('const sections = navSections')
  })
})
