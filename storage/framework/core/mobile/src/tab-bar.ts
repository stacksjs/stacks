/**
 * The phone's native tab bar, kept in step with the page's own.
 *
 * `NativeTabBar` always renders its links, and the router keeps them current:
 * it marks the current tab with `data-stx-nav-current`, sticky as on iOS, so a
 * workout opened from Today keeps Today lit. Inside Craft's iOS shell that bar
 * is hidden and mirrored into the native one, Liquid Glass on iOS 26 and
 * later: the tabs, which is current, the badges, and taps coming back as clicks
 * on the same links. Everything that decides which tab is current stays where
 * it was. Elsewhere — a browser, Android for now — nothing happens and the
 * page's bar shows.
 */
import type { NativeTab } from 'craft-native/mobile'
import { tabBar as craftTabBar } from 'craft-native/mobile'

export type { NativeTab, NativeTabBarOptions } from 'craft-native/mobile'

export interface TabBarApi {
  isAvailable: () => boolean
  set: (tabs: NativeTab[], options?: { selected?: string, tint?: string, tintDark?: string }) => boolean
  select: (id: string) => boolean
  hide: () => boolean
  onSelect: (callback: (id: string) => void) => () => void
}

export const tabBar: TabBarApi = craftTabBar

/** What one tab link describes; `href` is its id. */
export interface TabLink {
  id: string
  title: string
  symbol: string
  badge: string
  current: boolean
}

/** The tabs a bar's links describe, read from the attributes `NativeTabItem` writes. */
export function readTabLinks(nav: ParentNode): TabLink[] {
  return Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[data-native-tab]')).map(link => ({
    id: link.getAttribute('href') || '',
    title: link.getAttribute('data-native-tab') || link.getAttribute('aria-label') || '',
    symbol: link.getAttribute('data-native-tab-symbol') || 'circle',
    badge: (link.querySelector('.native-tab-badge')?.textContent || '').trim(),
    current: link.hasAttribute('data-stx-nav-current') || link.classList.contains('is-active'),
  })).filter(tab => tab.id && tab.title)
}

/** The native bar's description of those links: the tabs, and which is current. */
export function nativeTabs(links: TabLink[]): { tabs: NativeTab[], selected?: string } {
  const tabs = links.map(({ id, title, symbol, badge }) => (badge ? { id, title, symbol, badge } : { id, title, symbol }))
  return { tabs, selected: links.find(link => link.current)?.id }
}

function hexColor(value: string): string | undefined {
  const color = value.trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : undefined
}

export interface MirrorTabBarOptions {
  /**
   * Whether the current screen hides the bar, as a workout player does. By
   * default, whether the document holds a `[data-native-hide-tab-bar]`, the
   * same marker that hides the page's own bar.
   */
  hidden?: () => boolean
  api?: TabBarApi
}

/**
 * Mirror `nav`'s tabs into the native tab bar, for as long as the returned
 * function is not called. Answers null when there is no native bar, and the
 * page's own bar is the one to show.
 */
export function mirrorTabBar(nav: HTMLElement, options: MirrorTabBarOptions = {}): (() => void) | null {
  const api = options.api ?? tabBar
  if (!api.isAvailable()) return null
  const hidden = options.hidden ?? (() => Boolean(nav.ownerDocument?.querySelector('[data-native-hide-tab-bar]')))

  const style = typeof getComputedStyle === 'function' ? getComputedStyle(nav) : null
  const tint = hexColor(style?.getPropertyValue('--native-tab-active') || '')
  const tintDark = hexColor(style?.getPropertyValue('--native-tab-active-dark') || '')

  let last = ''
  const sync = (): void => {
    if (hidden()) {
      if (last !== 'hidden') api.hide()
      last = 'hidden'
      return
    }
    const { tabs, selected } = nativeTabs(readTabLinks(nav))
    const next = JSON.stringify({ tabs, selected })
    if (next === last) return
    // Only the current tab changed: say so, rather than describing the bar again.
    const previous = last && last !== 'hidden' ? JSON.parse(last) : null
    if (previous && selected && JSON.stringify(previous.tabs) === JSON.stringify(tabs)) api.select(selected)
    else api.set(tabs, { selected, tint, tintDark })
    last = next
  }

  const observer = typeof MutationObserver === 'function' ? new MutationObserver(sync) : null
  observer?.observe(nav, { attributes: true, attributeFilter: ['data-stx-nav-current', 'class'], childList: true, subtree: true, characterData: true })
  const stopSelect = api.onSelect((id) => {
    const link = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[data-native-tab]')).find(item => item.getAttribute('href') === id)
    link?.click()
  })
  // A screen that hides the bar arrives with a navigation, not a change to the bar.
  const onLoad = (): void => sync()
  if (typeof window !== 'undefined') window.addEventListener('stx:load', onLoad)
  sync()

  return () => {
    observer?.disconnect()
    stopSelect()
    if (typeof window !== 'undefined') window.removeEventListener('stx:load', onLoad)
    api.hide()
  }
}
