import { describe, expect, it } from 'bun:test'
import { mirrorTabBar, nativeTabs, readTabLinks } from '../src/tab-bar'
import type { TabBarApi } from '../src/tab-bar'

/** A tab link as NativeTabItem renders it, enough of one for these tests. */
function link(href: string, title: string, symbol: string, options: { current?: boolean, badge?: string } = {}) {
  const attributes: Record<string, string> = { 'href': href, 'data-native-tab': title, 'data-native-tab-symbol': symbol }
  if (options.current) attributes['data-stx-nav-current'] = ''
  let clicks = 0
  return {
    get clicks() { return clicks },
    click: () => { clicks++ },
    getAttribute: (name: string) => attributes[name] ?? null,
    hasAttribute: (name: string) => name in attributes,
    setCurrent: (on: boolean) => { if (on) attributes['data-stx-nav-current'] = ''; else delete attributes['data-stx-nav-current'] },
    classList: { contains: () => false },
    querySelector: () => (options.badge ? { textContent: options.badge } : null),
  }
}

function nav(links: ReturnType<typeof link>[]) {
  return { querySelectorAll: () => links, ownerDocument: { querySelector: () => null } } as unknown as HTMLElement
}

function fakeApi() {
  const calls: unknown[][] = []
  let onSelect: ((id: string) => void) | null = null
  const api: TabBarApi = {
    isAvailable: () => true,
    set: (tabs, options) => { calls.push(['set', tabs, options]); return true },
    select: (id) => { calls.push(['select', id]); return true },
    hide: () => { calls.push(['hide']); return true },
    onSelect: (callback) => { onSelect = callback; return () => { onSelect = null } },
  }
  return { api, calls, tap: (id: string) => onSelect?.(id), listening: () => onSelect !== null }
}

describe('the native tab bar', () => {
  it('reads the tabs NativeTabItem describes, and which one is current', () => {
    const links = [link('/m', 'Today', 'sun.max', { current: true }), link('/m/calendar', 'Calendar', 'calendar', { badge: '3' })]
    expect(nativeTabs(readTabLinks(nav(links)))).toEqual({
      tabs: [{ id: '/m', title: 'Today', symbol: 'sun.max' }, { id: '/m/calendar', title: 'Calendar', symbol: 'calendar', badge: '3' }],
      selected: '/m',
    })
  })

  it('mirrors them into the native bar, and a native tap clicks the link', () => {
    const today = link('/m', 'Today', 'sun.max', { current: true })
    const calendar = link('/m/calendar', 'Calendar', 'calendar')
    const { api, calls, tap, listening } = fakeApi()
    const stop = mirrorTabBar(nav([today, calendar]), { api })
    expect(stop).not.toBeNull()
    expect(calls[0]?.[0]).toBe('set')
    expect((calls[0]?.[2] as { selected?: string }).selected).toBe('/m')

    tap('/m/calendar')
    expect(calendar.clicks).toBe(1)
    expect(today.clicks).toBe(0)

    stop!()
    expect(calls.at(-1)).toEqual(['hide'])
    expect(listening()).toBe(false)
  })

  it('hides the native bar on a screen that hides the page\'s own', () => {
    const { api, calls } = fakeApi()
    mirrorTabBar(nav([link('/m', 'Today', 'sun.max', { current: true })]), { api, hidden: () => true })
    expect(calls).toEqual([['hide']])
  })

  it('leaves a browser to the page\'s own bar', () => {
    const { api } = fakeApi()
    expect(mirrorTabBar(nav([]), { api: { ...api, isAvailable: () => false } })).toBeNull()
  })
})
