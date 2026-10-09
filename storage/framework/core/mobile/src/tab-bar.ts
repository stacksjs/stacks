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

interface StxRouterTabs {
  selectTab?: (href: string) => unknown
}

function stxRouter(): StxRouterTabs | undefined {
  if (typeof window === 'undefined') return undefined
  const router = (window as unknown as { stxRouter?: StxRouterTabs }).stxRouter
  return router && typeof router === 'object' ? router : undefined
}

/** Whether the stx router runs the tabs itself (`data-stx-nav="tab"`, re-select included). */
export function routerHandlesTabs(): boolean {
  return typeof stxRouter()?.selectTab === 'function'
}

export interface TabReselectOptions {
  /** Scrolls the screen to its top; the window's by default. */
  scrollToTop?: () => void
}

/**
 * Choosing the tab already current scrolls its screen back to the top, as on
 * iOS, and announces `stx:tabreselect` { href } for a screen that wants to do
 * more (a list that resets its filter).
 *
 * The stx router does this itself for `data-stx-nav="tab"` links, popping to
 * the tab's root on a second choice; this covers a router that predates tabs,
 * and stands aside wherever the router has them.
 */
export function handleTabReselect(nav: HTMLElement, options: TabReselectOptions = {}): () => void {
  const onClick = (event: Event): void => {
    if (routerHandlesTabs() || event.defaultPrevented) return
    const link = (event.target as Element | null)?.closest?.('a[data-native-tab]')
    if (!link || !nav.contains(link)) return
    if (!link.hasAttribute('data-stx-nav-current') && !link.classList.contains('is-active') && link.getAttribute('aria-current') !== 'page') return
    event.preventDefault()
    const view = nav.ownerDocument.defaultView
    if (options.scrollToTop) options.scrollToTop()
    else view?.scrollTo?.({ top: 0, behavior: view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    view?.dispatchEvent(new CustomEvent('stx:tabreselect', { detail: { href: link.getAttribute('href') || '' } }))
  }
  nav.addEventListener('click', onClick)
  return () => nav.removeEventListener('click', onClick)
}

function hexColor(value: string): string | undefined {
  const color = value.trim()
  return /^#[0-9a-f]{6}$/i.test(color) ? color : undefined
}

/**
 * What an open sheet raises when it starts or stops covering the tab bar. A
 * sheet on iOS slides up over the tab bar; the native bar is drawn above the
 * page, so while one is up the bar steps aside instead.
 */
export const TAB_BAR_COVER_EVENT = 'stacks:tab-bar-cover'

/** Marks `element` as covering the tab bar, or no longer, and says so. */
export function coverTabBar(element: Element, covering: boolean): void {
  if (covering) element.setAttribute('data-native-covers-tab-bar', '')
  else element.removeAttribute('data-native-covers-tab-bar')
  element.ownerDocument?.defaultView?.dispatchEvent(new Event(TAB_BAR_COVER_EVENT))
}

export interface MirrorTabBarOptions {
  /**
   * Whether the current screen hides the bar, as a workout player does. By
   * default, whether the document holds a `[data-native-hide-tab-bar]`, the
   * same marker that hides the page's own bar, or an open sheet covering it
   * (`coverTabBar`).
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
  const hidden = options.hidden ?? (() => Boolean(nav.ownerDocument?.querySelector('[data-native-hide-tab-bar], [data-native-covers-tab-bar]')))

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
  // A native tap is the router's to handle as a tab switch (each tab keeps
  // its own screens; choosing the current one again scrolls it to the top,
  // then pops it to its root). A router without tabs gets the tap as a click
  // on the same link, as before.
  const stopSelect = api.onSelect((id) => {
    const router = stxRouter()
    if (router?.selectTab) {
      router.selectTab(id)
      return
    }
    const link = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[data-native-tab]')).find(item => item.getAttribute('href') === id)
    link?.click()
  })
  // A screen that hides the bar arrives with a navigation, not a change to the
  // bar. A kept screen the router shows again fires stx:screen-shown, not
  // stx:load, so both are heard. An open sheet covering the bar says so itself.
  const onLoad = (): void => sync()
  if (typeof window !== 'undefined') {
    window.addEventListener('stx:load', onLoad)
    window.addEventListener('stx:screen-shown', onLoad)
    window.addEventListener(TAB_BAR_COVER_EVENT, onLoad)
  }
  sync()

  return () => {
    observer?.disconnect()
    stopSelect()
    if (typeof window !== 'undefined') {
      window.removeEventListener('stx:load', onLoad)
      window.removeEventListener('stx:screen-shown', onLoad)
      window.removeEventListener(TAB_BAR_COVER_EVENT, onLoad)
    }
    api.hide()
  }
}
