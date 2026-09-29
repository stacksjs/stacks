import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (name: string) => readFileSync(join(import.meta.dir, `${name}.stx`), 'utf8')

describe('Native components', () => {
  it('decides native-only chrome once the bridge can answer', () => {
    const shell = read('NativeAppShell')
    expect(shell).toContain('whenNativeMobile()')
    // One class binding: a second one would overwrite the first.
    expect(shell.match(/:class=/g)?.length).toBe(1)
    // Deep links are opt-in, and open at their path through the router.
    expect(shell).toContain('followDeepLinks(path => navigate(path), deepLinkService)')
  })

  it('keeps a tab lit on the paths it names, and never drags a tab', () => {
    const item = read('NativeTabItem')
    expect(item).toContain('activeMatch="{{ match }}"')
    expect(item).toContain('draggable="false"')
  })

  it('shows the offline banner by class, so it can come back', () => {
    const banner = read('NativeNetworkBanner')
    expect(banner).not.toContain(':if="!connected()"')
    expect(banner).toContain('native-network-banner--quiet')
  })

  it('backs out through history, and sticks within the page rather than its wrapper', () => {
    const bar = read('NativeNavBar')
    expect(bar).toContain('if (goBack()) event.preventDefault()')
    expect(bar).toContain('[data-stx-scope]:has(> .native-nav) { display: contents; }')
    expect(bar).toContain("useReactiveProp<string>('title', '')")
  })

  it('lifts an open sheet out of the router\'s stacking context', () => {
    const sheet = read('NativeSheet')
    expect(sheet).toContain('main:has(.native-sheet.is-open) { view-transition-name: none; }')
    expect(sheet).toContain("useModel('open'")
  })

  it('refreshes through the shared gesture and hands the page done()', () => {
    const refresh = read('NativePullToRefresh')
    expect(refresh).toContain('observePullToRefresh(')
    expect(refresh).toContain("emit('refresh', { done: finish })")
  })

  it('reports a segment change with a selection haptic', () => {
    const control = read('NativeSegmentedControl')
    expect(control).toContain('haptics.selection()')
    expect(control).toContain("emit('change', value)")
  })

  it('steps the tab bar away for a screen that is a task of its own', () => {
    const shell = read('NativeAppShell')
    expect(shell).toContain('.native-app-shell:has([data-native-hide-tab-bar]) .native-app-tab-slot { display: none; }')
    expect(shell).toContain('.native-app-shell:has([data-native-hide-tab-bar]) { --native-tab-bar-height: 0px; }')
  })

  it('fills a ring to its value, clamped, with its content in the middle', () => {
    const ring = read('NativeProgressRing')
    expect(ring).toContain('Math.max(0, Math.min(100, Number(value()) || 0))')
    expect(ring).toContain('conic-gradient(var(--native-ring')
    expect(ring).toContain('<slot />')
  })
})
