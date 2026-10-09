import { describe, expect, it, spyOn } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { processDirectives } from '@stacksjs/stx'

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

  it('covers the tab bar while up, and closes when its screen is left', () => {
    const sheet = read('NativeSheet')
    expect(sheet).toContain('coverTabBar(element, true)')
    expect(sheet).toContain('coverTabBar(element, false)')
    expect(sheet).toContain("useEventListener('stx:navigate'")
    expect(sheet).toContain('if (to !== openedOn) close()')
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

  it('renders its segments in the browser, from whatever the options prop holds', async () => {
    // `options` is both the prop and the derived list the segments loop over.
    // stx once took the prop's value in the render context for server data and
    // turned the `:for` into a server `@foreach(options())`, which rendered an
    // empty track (the workout player's rest picker).
    const warn = spyOn(console, 'warn')
    try {
      const html = await processDirectives(
        `<NativeSegmentedControl label="Rest" :options="[{ label: '30s', value: 30 }, { label: '60s', value: 60 }]" />`,
        {},
        join(import.meta.dir, 'page.stx'),
        { componentsDir: import.meta.dir, partialsDir: import.meta.dir } as Parameters<typeof processDirectives>[3],
        new Set<string>(),
      )
      expect(html).toContain('class="native-segmented"')
      expect(html).toContain(':for="(option, index) in options()"')
      expect(html).not.toContain('Foreach Error')
      expect(warn.mock.calls.some(call => String(call[0]).includes('is not iterable server-side'))).toBe(false)
    }
    finally {
      warn.mockRestore()
    }
  })

  it('steps the tab bar away for a screen that is a task of its own', () => {
    const shell = read('NativeAppShell')
    expect(shell).toContain('.native-app-shell:has([data-native-hide-tab-bar]) .native-app-tab-slot { display: none; }')
    expect(shell).toContain('.native-app-shell:has([data-native-hide-tab-bar]) { --native-tab-bar-height: 0px; }')
  })

  it('fills a ring to its value, clamped, with its content in the middle', () => {
    const ring = read('NativeProgressRing')
    expect(ring).toContain('Math.max(0, Math.min(100, Number(value()) || 0))')
    expect(ring).toContain('<slot />')
  })

  it('draws the ring as a stroke with rounded ends that animates to its value', async () => {
    const ring = read('NativeProgressRing')
    expect(ring).not.toContain('conic-gradient')
    expect(ring).toContain('stroke-linecap: round;')
    expect(ring).toContain('transition: stroke-dashoffset')
    expect(ring).toContain('stroke-dashoffset:${100 - percent()}')
    // Its thickness is still the page's --native-ring-width, exactly.
    expect(ring).toContain('stroke-width: var(--native-ring-width, 5px);')
    const html = await render('<NativeProgressRing :value="40" :size="120" label="Rest" />')
    expect(html).toContain('pathLength="100"')
    expect(html).toContain('r="50%"')
  })
})

async function render(template: string): Promise<string> {
  return processDirectives(
    template,
    {},
    join(import.meta.dir, 'page.stx'),
    { componentsDir: import.meta.dir, partialsDir: import.meta.dir } as Parameters<typeof processDirectives>[3],
    new Set<string>(),
  )
}

describe('Native components feel native', () => {
  it('sets the shell in the system font at the phone\'s text size, and sizes the components off it', () => {
    const shell = read('NativeAppShell')
    expect(shell).toContain('font: -apple-system-body;')
    expect(shell).toContain('--native-font-size: calc(17px * var(--native-font-scale, var(--craft-font-scale, 1)));')
    for (const name of ['NativeNavBar', 'NativeSheet', 'NativeSegmentedControl'])
      expect(read(name)).toContain('var(--native-font-size, 17px)')
  })

  it('drops the tap flash and the double-tap delay, and gives pressables one pressed state', () => {
    const shell = read('NativeAppShell')
    expect(shell).toContain('-webkit-tap-highlight-color: transparent;')
    expect(shell).toContain('touch-action: manipulation;')
    expect(shell).toContain('[data-native-pressable]:active {')
    // Pressed at once, released with an ease.
    expect(shell).toMatch(/\[data-native-pressable\]:active \{[^}]*transition: none;/)
    expect(shell).toContain('stopPressables = installPressables(root.ownerDocument)')
  })

  it('keeps the native chrome in step with the page once in the phone app', () => {
    const shell = read('NativeAppShell')
    expect(shell).toContain('if (native && !destroyed) stopChrome = installNativeChrome(root.ownerDocument)')
  })

  it('links the bar to the scroll a frame at a time, and stretches the large title past the top', () => {
    const bar = read('NativeNavBar')
    expect(bar).toContain('stopScroll = observeLargeTitle(root, {')
    expect(bar).toContain('opacity: max(0.001, min(1, var(--native-nav-progress) * 1.5));')
    expect(bar).toContain('transform: scale(var(--native-nav-stretch, 1));')
    expect(bar).toContain('transform: translateY(calc((1 - var(--native-nav-progress)) * 0.5em));')
  })

  it('draws the back chevron as the SF Symbol, with its Iconify stand-in in the page', async () => {
    const html = await render('<NativeNavBar title="Workout" back="/m" />')
    expect(html).toContain('data-native-symbol="chevron.backward"')
    // Sized by the bar's class from the first paint.
    expect(html).toContain('class="native-symbol i-lucide-chevron-left native-nav-back-icon"')
  })

  it('draws an SF Symbol from the shell, cached, over an Iconify stand-in', async () => {
    const symbol = read('NativeSymbol')
    expect(symbol).toContain('symbols.cached(name, options)')
    expect(symbol).toContain('mask: var(--native-symbol) center / contain no-repeat;')
    const labelled = await render('<NativeSymbol name="star" label="Favourite" />')
    expect(labelled).toContain('class="native-symbol i-lucide-star"')
    expect(labelled).toContain('role="img" aria-label="Favourite"')
    const own = await render('<NativeSymbol name="figure.run" icon="i-lucide-footprints" />')
    expect(own).toContain('class="native-symbol i-lucide-footprints"')
    expect(own).toContain('aria-hidden="true"')
  })

  it('drags a sheet by its grabber and header, between detents, and away', async () => {
    const sheet = read('NativeSheet')
    expect(sheet).toContain('stopDrag = observeSheetDrag({')
    expect(sheet).toContain('const handles = [grabber.current, header.current]')
    expect(sheet).toContain("if (to === 'dismiss') close()")
    expect(sheet).toContain('.native-sheet.is-open.is-medium .native-sheet-panel { transform: translateY(calc(100% - 50dvh)); }')
    const html = await render('<NativeSheet title="Edit" detents="medium large"><p>Body</p></NativeSheet>')
    expect(html).toContain('data-stx-ref="nativeSheetGrabber"')
    expect(html).toContain('data-stx-ref="nativeSheetHeader"')
  })

  it('opens a sheet without a haptic, holds the page behind it, and keeps focus inside', () => {
    const sheet = read('NativeSheet')
    expect(sheet).not.toContain('haptics')
    expect(sheet).toContain('releaseBackground = lockBackground(element)')
    expect(sheet).toContain('trapFocus(panel.current as HTMLElement, event)')
    expect(sheet).toContain('putBack ??= liftToBody(element)')
  })

  it('presses the page back into a card behind a large sheet, unless motion is reduced', () => {
    const sheet = read('NativeSheet')
    expect(sheet).toContain('presentPageAsCard(element.ownerDocument, want)')
    expect(sheet).toContain(':root[data-native-sheet-card] .native-app-content {')
    expect(sheet).toContain(':root[data-native-reduce-motion][data-native-sheet-card] .native-app-content { transform: none; border-radius: 0; }')
  })

  it('refreshes with the native control where the shell has it, and the 12-spoke indicator elsewhere', async () => {
    const refresh = read('NativePullToRefresh')
    expect(refresh).toContain('stop = observeNativeRefresh(element, {')
    expect(refresh).toContain("if (element && !scrollHost() && refresh.isAvailable())")
    expect(refresh).toContain('host: resolveScrollHost(scrollHost()),')
    const html = await render('<NativePullToRefresh><p>List</p></NativePullToRefresh>')
    expect(html.match(/class="native-ptr-spoke"/g)?.length).toBe(12)
  })

  it('holds the content down while refreshing, and never leaves a transform on it at rest', () => {
    const refresh = read('NativePullToRefresh')
    expect(refresh).toContain('const shift = refreshing() ? HOLD : Math.max(0, distance() - bounce())')
    expect(refresh).toContain('.native-ptr:is(.is-pulling, .is-refreshing) .native-ptr-content {')
    expect(refresh).not.toMatch(/\n {2}\.native-ptr-content \{[^}]*transform:/)
  })

  it('opens a context menu on a half-second press, natively or over a blurred page', async () => {
    const menu = read('NativeContextMenu')
    expect(menu).toContain("useReactiveProp<number>('delay', 500)")
    expect(menu).toContain("void haptics.impact('medium')")
    expect(menu).toContain('showContextMenuFor(element, { items: items(), title: title() || undefined })')
    expect(menu).toContain("emit('select', id)")
    expect(menu).toContain('-webkit-touch-callout: none;')
    const html = await render('<NativeContextMenu :items="[{ id: \'copy\', title: \'Copy\' }]"><p>Row</p></NativeContextMenu>')
    expect(html).toContain('data-native-context-menu')
  })

  it('raises an action sheet through the shell, or drawn in HTML', async () => {
    const sheet = read('NativeActionSheet')
    expect(sheet).toContain('void dialog.actionSheet({')
    expect(sheet).toContain("if (id) emit('select', id)")
    expect(sheet).toContain("useModel('open'")
    const html = await render('<NativeActionSheet title="Workout" :actions="[{ id: \'skip\', title: \'Skip\' }]" />')
    expect(html).toContain('data-native-action-sheet')
  })

  it('scrubs, shrinks under a finger, and moves with the arrow keys', async () => {
    const control = read('NativeSegmentedControl')
    expect(control).toContain('stopScrub = observeSegmentScrub(element, {')
    expect(control).toContain("${pressed() ? ' scale(0.95)' : ''}")
    expect(control).toContain('const next = segmentForKey(event.key, activeIndex(), options().length)')
    expect(control).toContain(':tabindex="index === activeIndex() ? \'0\' : \'-1\'"')
  })

  it('darkens the offline banner with the app\'s theme, not the system\'s', () => {
    const banner = read('NativeNetworkBanner')
    expect(banner).not.toContain('prefers-color-scheme')
    expect(banner).toContain('.dark .native-network-banner {')
  })

  it('marks each tab for the router, and scrolls a re-selected tab to its top', async () => {
    const item = read('NativeTabItem')
    expect(item).toContain('data-stx-nav="tab"')
    const bar = read('NativeTabBar')
    expect(bar).toContain('stopReselect = handleTabReselect(nav)')
    // No haptic for a tap the phone's own bar made.
    expect(bar).toContain('if (!mirrored) void haptics.selection()')
  })
})
