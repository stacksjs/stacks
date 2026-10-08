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

  it('hands the tab bar to the phone inside Craft, and draws the glass capsule elsewhere', () => {
    const bar = read('NativeTabBar')
    // The links stay as the native bar's model; the router keeps them current.
    expect(bar).toContain('stopMirror = mirrorTabBar(nav)')
    expect(bar).toContain('html[data-craft-chrome] .native-tab-bar { display: none; }')
    expect(bar).toContain('border-radius: 999px;')
    const item = read('NativeTabItem')
    expect(item).toContain('data-native-tab="{{ label }}"')
    expect(item).toContain('data-native-tab-symbol="{{ symbol }}"')
    const shell = read('NativeAppShell')
    expect(shell).toContain('padding-bottom: calc(var(--craft-tab-bar-height, 6rem) + 0.75rem);')
  })

  it('puts the account at the top right: initials or a photo, a count, a native press', () => {
    const button = read('NativeAccountButton')
    // Reactive, so it follows the signed-in person and the count.
    expect(button).toContain("useReactiveProp<string>('name', '')")
    expect(button).toContain("useReactiveProp<string | number>('badge', '')")
    expect(button).toContain('data-stx-link data-stx-prefetch="eager"')
    expect(button).toContain('void haptics.selection()')
    // A photo is a background, not an <img>: apps check that every image goes through their delivery.
    expect(button).not.toContain('<img')
  })

  it('lifts the launch splash once the first screen has painted', () => {
    expect(read('NativeAppShell')).toContain('requestAnimationFrame(() => requestAnimationFrame(() => splash.hide()))')
  })

  it('keeps a tab lit on the paths it names, and never drags a tab', () => {
    const item = read('NativeTabItem')
    expect(item).toContain('activeMatch="{{ match }}"')
    expect(item).toContain('draggable="false"')
  })

  it('switches tabs instantly: prefetched, and without the cross-fade', () => {
    const item = read('NativeTabItem')
    expect(item).toContain('data-stx-prefetch="eager"')
    expect(item).toContain('data-stx-transition="none"')
  })

  it('centres each tab in the bar rather than against its top border', () => {
    // stx wraps each NativeTabItem in a scope box; the box stretched while
    // the link inside kept its own height, so icons sat on the border.
    const bar = read('NativeTabBar')
    expect(bar).toContain('.native-tab-bar > [data-stx-scope]:has(> .native-tab-item) { display: contents; }')
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

  it('steps the tab bar aside while the keyboard is up', () => {
    const shell = read('NativeAppShell')
    expect(shell).toContain('textarea, select, [contenteditable=true]):focus) .native-app-tab-slot')
    expect(shell).toContain('visibility: hidden;')
  })

  it('keeps every text field big enough that iOS does not zoom into it', () => {
    expect(read('NativeAppShell')).toContain('.native-app-shell :is(input, textarea, select) { font-size: max(16px, 1em); }')
  })

  it('keeps the tab a screen was opened from lit', () => {
    expect(read('NativeTabBar')).toContain('data-stx-sticky-active')
  })

  it('names the screen the back button returns to, and gives way to the title', () => {
    const bar = read('NativeNavBar')
    expect(bar).toContain('enterNavTrail(navTrail(), window.location.pathname + window.location.search)')
    expect(bar).toContain('@container (max-width: 6.5rem)')
    expect(bar).toContain("useReactiveProp<boolean>('titleOnScroll', false)")
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
