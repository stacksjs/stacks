import { afterEach, describe, expect, it, mock } from 'bun:test'
import { Window } from 'very-happy-dom'
import {
  applyAppearance,
  handleTabReselect,
  installNativeChrome,
  installPressables,
  largeTitleMetrics,
  liftToBody,
  lockBackground,
  mirrorTabBar,
  observeNativeRefresh,
  showContextMenuFor,
  focusSegment,
  observeLargeTitle,
  observeLongPress,
  pageBackground,
  pageScrollTop,
  placeMenu,
  pullDistance,
  rubberBand,
  segmentAt,
  segmentForKey,
  settleSheet,
  sheetStops,
} from '../src'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function install(craft?: Record<string, unknown>): any {
  const win: any = new Window({ url: 'https://example.com/' })
  if (craft) win.craft = craft
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win })
  return win
}

const tick = (ms = 0): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

describe('sheet detents', () => {
  const stops = sheetStops(800, 900, ['medium', 'large'])

  it('rests large at the top, medium at half the screen, and dismissed below the panel', () => {
    expect(stops).toEqual([{ name: 'large', y: 0 }, { name: 'medium', y: 350 }, { name: 'dismiss', y: 800 }])
    expect(sheetStops(400, 900, ['large'])).toEqual([{ name: 'large', y: 0 }, { name: 'dismiss', y: 400 }])
  })

  it('springs back to the nearest detent after a slow drag', () => {
    expect(settleSheet({ y: 120, velocity: 0.1, stops })).toBe('large')
    expect(settleSheet({ y: 260, velocity: 0, stops })).toBe('medium')
    expect(settleSheet({ y: 500, velocity: 0.2, stops })).toBe('medium')
  })

  it('dismisses past half of what the lowest detent shows', () => {
    expect(settleSheet({ y: 580, velocity: 0, stops })).toBe('dismiss')
    expect(settleSheet({ y: 199, velocity: 0, stops: sheetStops(400, 900, ['large']) })).toBe('large')
    expect(settleSheet({ y: 201, velocity: 0, stops: sheetStops(400, 900, ['large']) })).toBe('dismiss')
  })

  it('goes on to the next stop on a flick faster than 0.5px/ms', () => {
    expect(settleSheet({ y: 30, velocity: 0.8, stops })).toBe('medium')
    expect(settleSheet({ y: 360, velocity: 0.8, stops })).toBe('dismiss')
    expect(settleSheet({ y: 330, velocity: -0.9, stops })).toBe('large')
    expect(settleSheet({ y: 40, velocity: 0.6, stops: sheetStops(400, 900, ['large']) })).toBe('dismiss')
  })

  it('resists being pulled past the top, more the further it goes', () => {
    expect(rubberBand(0)).toBe(0)
    expect(rubberBand(100)).toBeLessThan(100)
    expect(rubberBand(400) - rubberBand(300)).toBeLessThan(rubberBand(100))
  })
})

describe('holding the page behind a sheet', () => {
  it('makes everything else inert, stops the page scrolling, and gives both back', () => {
    const win = install()
    const doc = win.document
    doc.body.innerHTML = '<header id="top"></header><main><p id="text"></p><div id="sheet"></div></main><nav id="tabs"></nav>'
    const release = lockBackground(doc.getElementById('sheet'))
    expect(doc.getElementById('top').hasAttribute('inert')).toBe(true)
    expect(doc.getElementById('text').hasAttribute('inert')).toBe(true)
    expect(doc.getElementById('tabs').hasAttribute('inert')).toBe(true)
    expect(doc.getElementById('sheet').hasAttribute('inert')).toBe(false)
    expect(doc.documentElement.style.overflow).toBe('hidden')
    const nested = lockBackground(doc.getElementById('text'))
    nested()
    // Still held: the first sheet is open.
    expect(doc.documentElement.style.overflow).toBe('hidden')
    release()
    expect(doc.getElementById('top').hasAttribute('inert')).toBe(false)
    expect(doc.documentElement.style.overflow || '').toBe('')
  })

  it('lifts a sheet to the body and puts it back where it was', () => {
    const win = install()
    const doc = win.document
    doc.body.innerHTML = '<main><section id="page"><div id="sheet"></div><p id="after"></p></section></main>'
    const sheet = doc.getElementById('sheet')
    const restore = liftToBody(sheet)
    expect(sheet.parentElement).toBe(doc.body)
    restore()
    expect(sheet.parentElement.id).toBe('page')
    expect(sheet.nextElementSibling.id).toBe('after')
  })
})

describe('large titles', () => {
  it('collapses over the title\'s height and stretches a little when pulled past the top', () => {
    expect(largeTitleMetrics(0)).toEqual({ progress: 0, stretch: 1 })
    expect(largeTitleMetrics(26, 52).progress).toBe(0.5)
    expect(largeTitleMetrics(500, 52).progress).toBe(1)
    expect(largeTitleMetrics(-60).stretch).toBe(1.1)
    expect(largeTitleMetrics(-3000).stretch).toBe(1.1)
  })

  it('writes the progress where the bar\'s CSS reads it', () => {
    const win = install()
    win.document.body.innerHTML = '<div id="nav"></div>'
    const nav = win.document.getElementById('nav')
    const host = Object.assign(new EventTarget(), { scrollY: 26 })
    const stop = observeLargeTitle(nav, { height: 52, host })
    expect(nav.style.getPropertyValue('--native-nav-progress')).toBe('0.5')
    expect(nav.style.getPropertyValue('--native-nav-stretch')).toBe('1')
    stop()
  })

  it('reads a scrolling element\'s offset, for a screen that scrolls in a container', () => {
    const container = Object.assign(new EventTarget(), { scrollTop: 40 })
    expect(pageScrollTop(container)).toBe(40)
    expect(pullDistance(-30, 0)).toBe(30)
  })
})

describe('controls', () => {
  it('finds the segment under a finger, clamped to the ends', () => {
    const rect = { left: 10, width: 300 }
    expect(segmentAt(15, rect, 3)).toBe(0)
    expect(segmentAt(160, rect, 3)).toBe(1)
    expect(segmentAt(305, rect, 3)).toBe(2)
    expect(segmentAt(-50, rect, 3)).toBe(0)
    expect(segmentAt(900, rect, 3)).toBe(2)
  })

  it('moves between segments with the arrow keys, wrapping round', () => {
    expect(segmentForKey('ArrowRight', 2, 3)).toBe(0)
    expect(segmentForKey('ArrowLeft', 0, 3)).toBe(2)
    expect(segmentForKey('End', 0, 3)).toBe(2)
    expect(segmentForKey('Enter', 0, 3)).toBeNull()
  })

  it('fires a long press after its delay, and swallows the click that follows', async () => {
    const win = install()
    win.document.body.innerHTML = '<a id="row" href="/x">Row</a>'
    const row = win.document.getElementById('row')
    const pressed = mock(() => {})
    const stop = observeLongPress(row, { delay: 20, onLongPress: pressed })
    row.dispatchEvent(Object.assign(new win.Event('pointerdown'), { clientX: 5, clientY: 5, button: 0 }))
    await tick(40)
    expect(pressed).toHaveBeenCalledWith({ x: 5, y: 5 })
    const click = new win.Event('click', { cancelable: true })
    row.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    stop()
  })

  it('lets a finger that moves away scroll instead', async () => {
    const win = install()
    win.document.body.innerHTML = '<div id="row"></div>'
    const row = win.document.getElementById('row')
    const pressed = mock(() => {})
    const stop = observeLongPress(row, { delay: 20, onLongPress: pressed })
    row.dispatchEvent(Object.assign(new win.Event('pointerdown'), { clientX: 5, clientY: 5, button: 0 }))
    row.dispatchEvent(Object.assign(new win.Event('pointermove'), { clientX: 5, clientY: 40 }))
    await tick(40)
    expect(pressed).not.toHaveBeenCalled()
    stop()
  })

  it('wakes the haptics when a finger lands on a pressable', async () => {
    const prepare = mock(async () => {})
    const win = install({ haptics: { prepare } })
    win.document.body.innerHTML = '<button data-native-pressable><span id="inside">Go</span></button><p id="plain"></p>'
    const stop = installPressables(win.document)
    win.document.getElementById('plain').dispatchEvent(new win.Event('touchstart', { bubbles: true }))
    win.document.getElementById('inside').dispatchEvent(new win.Event('touchstart', { bubbles: true }))
    await tick()
    expect(prepare).toHaveBeenCalledTimes(1)
    stop()
  })

  it('opens a menu below its element, or above when there is no room', () => {
    expect(placeMenu({ x: 20, y: 100, width: 200, height: 40 }, { width: 250, height: 200 }, { width: 390, height: 844 }))
      .toEqual({ top: 148, left: 20, origin: 'top left' })
    const above = placeMenu({ x: 300, y: 700, width: 80, height: 40 }, { width: 250, height: 200 }, { width: 390, height: 844 })
    expect(above.top).toBe(492)
    expect(above.left).toBe(128)
    expect(above.origin).toBe('bottom right')
  })
})

describe('tabs', () => {
  it('scrolls the current tab to its top and says so, where the router has no tabs', () => {
    const win = install()
    win.document.body.innerHTML = '<nav id="bar"><a href="/m" data-native-tab="Today" class="is-active">Today</a><a href="/m/x" data-native-tab="X">X</a></nav>'
    const scrollToTop = mock(() => {})
    const heard: string[] = []
    win.addEventListener('stx:tabreselect', (event: any) => heard.push(event.detail.href))
    const stop = handleTabReselect(win.document.getElementById('bar'), { scrollToTop })
    const current = new win.Event('click', { bubbles: true, cancelable: true })
    win.document.querySelector('a[href="/m"]').dispatchEvent(current)
    expect(current.defaultPrevented).toBe(true)
    expect(scrollToTop).toHaveBeenCalledTimes(1)
    expect(heard).toEqual(['/m'])
    const other = new win.Event('click', { bubbles: true, cancelable: true })
    win.document.querySelector('a[href="/m/x"]').dispatchEvent(other)
    expect(other.defaultPrevented).toBe(false)
    stop()
  })

  it('stands aside where the router runs the tabs', () => {
    const win = install()
    win.stxRouter = { selectTab: () => {} }
    win.document.body.innerHTML = '<nav id="bar"><a href="/m" data-native-tab="Today" class="is-active">Today</a></nav>'
    const scrollToTop = mock(() => {})
    const stop = handleTabReselect(win.document.getElementById('bar'), { scrollToTop })
    win.document.querySelector('a').dispatchEvent(new win.Event('click', { bubbles: true, cancelable: true }))
    expect(scrollToTop).not.toHaveBeenCalled()
    stop()
  })

  it('hands a native tab tap to the router\'s tabs when it has them', () => {
    const win = install()
    const selectTab = mock(() => {})
    win.stxRouter = { selectTab }
    win.document.body.innerHTML = '<nav id="bar"><a href="/m" data-native-tab="Today">Today</a></nav>'
    let select: ((id: string) => void) | undefined
    const stop = mirrorTabBar(win.document.getElementById('bar'), {
      hidden: () => false,
      api: { isAvailable: () => true, set: () => true, select: () => true, hide: () => true, onSelect: (callback) => { select = callback; return () => {} } },
    })
    select!('/m')
    expect(selectTab).toHaveBeenCalledWith('/m')
    stop?.()
  })
})

describe('the native chrome', () => {
  it('writes the appearance where CSS reads it', () => {
    const win = install()
    const root = win.document.documentElement
    applyAppearance(root, { fontScale: 1.24, reduceMotion: true, reduceTransparency: false, colorScheme: 'light' })
    expect(root.style.getPropertyValue('--native-font-scale')).toBe('1.24')
    expect(root.hasAttribute('data-native-reduce-motion')).toBe(true)
    expect(root.hasAttribute('data-native-reduce-transparency')).toBe(false)
  })

  it('colours the under-page area like the page, picks the status bar for its scheme, and hides the keyboard bar', async () => {
    const setUnderPageColor = mock(async () => {})
    const setKeyboardAccessory = mock(async () => {})
    const setStyle = mock(async () => {})
    const win = install({ chrome: { setUnderPageColor, setKeyboardAccessory }, statusBar: { setStyle } })
    win.document.body.style.backgroundColor = 'rgb(2, 6, 23)'
    win.document.documentElement.classList.add('dark')
    expect(pageBackground(win.document)).toBe('rgb(2, 6, 23)')
    const stop = installNativeChrome(win.document)
    await tick()
    expect(setKeyboardAccessory).toHaveBeenCalledWith(false)
    expect(setUnderPageColor).toHaveBeenCalledWith('rgb(2, 6, 23)')
    expect(setStyle).toHaveBeenLastCalledWith('light')
    stop()
  })
})

describe('the native refresh control', () => {
  function shown(win: any, id: string, visible: boolean): any {
    const element = win.document.getElementById(id)
    element.getClientRects = () => (visible ? [{ width: 1, height: 1 }] : [])
    return element
  }

  it('turns on for a screen in view, refreshes only that screen, and ends the spinner after', async () => {
    const enable = mock(async () => {})
    const disable = mock(async () => {})
    const end = mock(async () => {})
    const win = install({ refresh: { enable, disable, end } })
    win.document.body.innerHTML = '<div id="today"></div><div id="calendar"></div>'
    const today = shown(win, 'today', false)
    const calendar = shown(win, 'calendar', true)
    const refreshed: string[] = []
    const stopToday = observeNativeRefresh(today, { onRefresh: () => refreshed.push('today') })
    const stopCalendar = observeNativeRefresh(calendar, { tintColor: '#2563eb', onRefresh: () => refreshed.push('calendar') })
    await tick()
    expect(enable).toHaveBeenCalledWith({ tintColor: '#2563eb' })
    win.dispatchEvent(new win.CustomEvent('craftRefresh'))
    await tick(5)
    expect(refreshed).toEqual(['calendar'])
    expect(end).toHaveBeenCalledTimes(1)
    stopCalendar()
    stopToday()
    await tick()
    expect(disable).toHaveBeenCalled()
  })
})

describe('element helpers', () => {
  it('opens a context menu beside an element', async () => {
    const show = mock(async () => 'copy')
    const win = install({ contextMenu: { show } })
    win.document.body.innerHTML = '<div id="row"></div>'
    const row = win.document.getElementById('row')
    row.getBoundingClientRect = () => ({ x: 4.2, y: 10, width: 300, height: 44, left: 4.2, top: 10 })
    expect(await showContextMenuFor(row, { items: [{ id: 'copy', title: 'Copy' }] })).toBe('copy')
    expect((show.mock.calls[0] as any)[0].anchor).toEqual({ x: 4, y: 10, width: 300, height: 44 })
  })

  it('moves focus to a segment', () => {
    const win = install()
    win.document.body.innerHTML = '<div id="track"><button role="tab">A</button><button role="tab" id="b">B</button></div>'
    focusSegment(win.document.getElementById('track'), 1)
    expect(win.document.activeElement.id).toBe('b')
  })
})
