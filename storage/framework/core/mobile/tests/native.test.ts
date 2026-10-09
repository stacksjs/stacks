import { afterEach, describe, expect, it, mock } from 'bun:test'
import { Window } from 'very-happy-dom'
import {
  background,
  browser,
  callNative,
  clipboard,
  confirmAction,
  contextMenu,
  currentAppearance,
  db,
  dialog,
  files,
  haptics,
  onAppearance,
  onBackgroundRefresh,
  onResume,
  onSilentPush,
  refresh,
  secureStorage,
  shortcuts,
  snapshots,
  statusBar,
  storeKit,
  symbols,
  toNativeRect,
  whenBridgeReady,
} from '../src'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

/** A browser window, or the phone shell's when `phone`: its message handler is there before its bridge. */
function install(options: { craft?: Record<string, unknown>, phone?: boolean } = {}): any {
  const win: any = new Window({ url: 'https://example.com/' })
  if (options.craft) win.craft = options.craft
  if (options.phone) win.webkit = { messageHandlers: { craft: { postMessage() {} } } }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win })
  return win
}

const tick = (ms = 0): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

afterEach(() => {
  symbols.clearCache()
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

describe('snapshots for native screens', () => {
  it('hands the shell what a native screen draws first, and does nothing in a browser', () => {
    install()
    expect(snapshots.isAvailable()).toBe(false)
    expect(snapshots.set('today', { a: 1 })).toBe(false)

    const win = install()
    const posted: unknown[] = []
    win.webkit = { messageHandlers: { craftHybrid: { postMessage: (message: unknown) => posted.push(message) } } }
    expect(snapshots.isAvailable()).toBe(true)
    expect(snapshots.set('today', { fitness: 42 })).toBe(true)
    expect(snapshots.clear()).toBe(true)
    expect(posted).toEqual([{ type: 'snapshotSet', name: 'today', json: '{"fitness":42}' }, { type: 'snapshotClear' }])
    expect(() => snapshots.set('../today', {})).toThrow()
  })
})

describe('waiting for the bridge', () => {
  it('holds a call made before the phone shell installs its bridge, and sends it natively once it does', async () => {
    const win = install({ phone: true })
    const confirm = mock(async () => true)
    const answer = dialog.confirm({ title: 'Delete?' })
    await tick()
    // No HTML stand-in was drawn while the bridge was on its way.
    expect(win.document.querySelector('[data-native-dialog]')).toBeNull()
    win.craft = { dialog: { confirm } }
    win.dispatchEvent(new win.CustomEvent('craftReady'))
    expect(await answer).toBe(true)
    expect(confirm).toHaveBeenCalledWith({ title: 'Delete?' })
  })

  it('falls back to the web once a host that never installs a bridge has had its time', async () => {
    install({ phone: true })
    const started = Date.now()
    const value = await callNative('dialog.confirm', [], () => 'web', { timeoutMs: 30 })
    expect(value).toBe('web')
    expect(Date.now() - started).toBeGreaterThanOrEqual(25)
  })

  it('answers a browser at once, without waiting', async () => {
    install()
    expect(await whenBridgeReady(5000)).toBe(false)
    expect(await callNative('dialog.confirm', [], () => 'web')).toBe('web')
  })

  it('takes the web path at once on a shell that predates the API', async () => {
    install({ craft: { platform: 'ios', capabilities: {} } })
    expect(await callNative('symbols.image', ['star'], () => 'none')).toBe('none')
  })

  it('reaches the native secure storage for a read made during launch, not localStorage', async () => {
    const win = install({ phone: true })
    const reading = secureStorage.get('token')
    await tick()
    win.craft = { secureStorage: { get: async (key: string) => `native:${key}` } }
    win.dispatchEvent(new win.CustomEvent('craftReady'))
    expect(await reading).toBe('native:token')
  })
})

describe('dialogs', () => {
  it('draws an HTML confirm in a browser and resolves with the answer', async () => {
    const win = install()
    const answer = dialog.confirm({ title: 'Discard the draft?', confirmLabel: 'Discard', destructive: true })
    await tick()
    const root = win.document.querySelector('[data-native-dialog="alert"]')
    expect(root).not.toBeNull()
    expect(root.querySelector('.native-dialog-title').textContent).toBe('Discard the draft?')
    const discard = root.querySelector('[data-action-id="confirm"]')
    expect(discard.classList.contains('is-destructive')).toBe(true)
    // Two choices sit side by side, as an iOS alert lays them out.
    expect(root.querySelector('.native-dialog-actions').classList.contains('is-row')).toBe(true)
    discard.click()
    expect(await answer).toBe(true)
    await tick(300)
    expect(win.document.querySelector('[data-native-dialog]')).toBeNull()
  })

  it('answers false when the HTML confirm is cancelled with Escape', async () => {
    const win = install()
    const answer = dialog.confirm({ title: 'Leave?' })
    await tick()
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(await answer).toBe(false)
  })

  it('raises an HTML action sheet with Cancel set apart, and answers null for it', async () => {
    const win = install()
    const answer = dialog.actionSheet({ title: 'Workout', actions: [{ id: 'skip', title: 'Skip' }, { id: 'delete', title: 'Delete', style: 'destructive' }] })
    await tick()
    const sheet = win.document.querySelector('[data-native-dialog="sheet"]')
    const groups = sheet.querySelectorAll('.native-dialog-group')
    expect(groups.length).toBe(2)
    expect(groups[1].textContent).toBe('Cancel')
    groups[1].querySelector('button').click()
    expect(await answer).toBeNull()
  })

  it('answers the chosen action from the HTML sheet', async () => {
    const win = install()
    const answer = dialog.actionSheet({ actions: [{ id: 'skip', title: 'Skip' }, { id: 'cancel', title: 'Keep', style: 'cancel' }] })
    await tick()
    // The page's own cancel action is the one set apart; no second Cancel is added.
    expect(win.document.querySelectorAll('.native-dialog-action').length).toBe(2)
    win.document.querySelector('[data-action-id="skip"]').click()
    expect(await answer).toBe('skip')
  })

  it('treats the native sheet answering its cancel action as no choice', async () => {
    install({ craft: { dialog: { actionSheet: async () => 'keep' } } })
    expect(await dialog.actionSheet({ actions: [{ id: 'keep', title: 'Keep', style: 'cancel' }] })).toBeNull()
  })

  it('sends the native sheet a plain anchor rectangle', async () => {
    const actionSheet = mock(async () => 'delete')
    install({ craft: { dialog: { actionSheet } } })
    await dialog.actionSheet({ actions: [{ id: 'delete', title: 'Delete' }], anchor: { x: 10.4, y: 20.6, width: 100, height: 44 } })
    expect((actionSheet.mock.calls[0] as any)[0].anchor).toEqual({ x: 10, y: 21, width: 100, height: 44 })
  })

  it('falls back to HTML when the native dialog fails', async () => {
    const win = install({ craft: { dialog: { alert: async () => { throw new Error('no window') } } } })
    const shown = dialog.alert({ title: 'Saved' })
    await tick()
    win.document.querySelector('[data-action-id="ok"]').click()
    await shown
  })

  it('confirms a destructive action from a sheet, and anything else in an alert', async () => {
    const actionSheet = mock(async () => 'confirm')
    const confirm = mock(async () => false)
    install({ craft: { dialog: { actionSheet, confirm } } })
    expect(await confirmAction({ title: 'Delete?', confirmLabel: 'Delete', destructive: true })).toBe(true)
    expect((actionSheet.mock.calls[0] as any)[0].actions).toEqual([
      { id: 'confirm', title: 'Delete', style: 'destructive' },
      { id: 'cancel', title: 'Cancel', style: 'cancel' },
    ])
    expect(await confirmAction({ title: 'Sign out?' })).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('resolves without a document during server rendering', async () => {
    Reflect.deleteProperty(globalThis, 'window')
    expect(await dialog.confirm({ title: 'x' })).toBe(false)
    expect(await dialog.actionSheet({ actions: [] })).toBeNull()
  })
})

describe('context menus', () => {
  it('hands the native menu the items without the web icons', async () => {
    const show = mock(async () => 'share')
    install({ craft: { contextMenu: { show } } })
    const id = await contextMenu.show({ items: [{ id: 'share', title: 'Share', symbol: 'square.and.arrow.up', icon: 'i-lucide-share' }], anchor: { x: 1, y: 2, width: 3, height: 4 } })
    expect(id).toBe('share')
    expect((show.mock.calls[0] as any)[0].items[0].icon).toBeUndefined()
    expect((show.mock.calls[0] as any)[0].items[0].symbol).toBe('square.and.arrow.up')
  })

  it('draws an HTML menu over a blurred page in a browser', async () => {
    const win = install()
    const answer = contextMenu.show({ title: 'Workout', items: [{ id: 'copy', title: 'Copy' }, { id: 'delete', title: 'Delete', destructive: true, disabled: true }], anchor: { x: 20, y: 100, width: 200, height: 60 } })
    await tick()
    const menu = win.document.querySelector('[data-native-dialog="menu"] [role="menu"]')
    expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(2)
    expect(menu.querySelector('[data-action-id="delete"]').disabled).toBe(true)
    menu.querySelector('[data-action-id="copy"]').click()
    expect(await answer).toBe('copy')
  })
})

describe('the in-app browser', () => {
  it('answers what the native sign-in session returned', async () => {
    install({ craft: { browser: { open: async () => ({ url: 'hq://done?code=1', cancelled: false }) } } })
    expect(await browser.open('https://auth.example.com', { mode: 'auth', callbackScheme: 'hq' })).toEqual({ url: 'hq://done?code=1', cancelled: false })
  })

  it('opens a new tab in a browser', async () => {
    const win = install()
    const open = mock(() => ({}))
    win.open = open
    expect(await browser.open('https://example.org')).toEqual({ cancelled: false })
    expect(open).toHaveBeenCalledWith('https://example.org', '_blank', 'noopener')
  })

  it('hands the link to Safari on a shell before the in-app browser', async () => {
    const openURL = mock(async () => true)
    install({ craft: { openURL } })
    await browser.open('https://example.org')
    expect(openURL).toHaveBeenCalledWith('https://example.org')
  })
})

describe('SF Symbols', () => {
  it('asks the shell once per symbol and size, and answers later asks from memory', async () => {
    const image = mock(async (name: string) => `data:image/png;base64,${name}`)
    install({ craft: { symbols: { image } } })
    expect(symbols.cached('star')).toBeUndefined()
    const [a, b] = await Promise.all([symbols.image('star'), symbols.image('star')])
    expect(a).toBe('data:image/png;base64,star')
    expect(b).toBe(a)
    expect(await symbols.image('star')).toBe(a)
    expect(image).toHaveBeenCalledTimes(1)
    expect(symbols.cached('star')).toBe(a)
    await symbols.image('star', { pointSize: 22 })
    expect(image).toHaveBeenCalledTimes(2)
  })

  it('answers null where there are none', async () => {
    install()
    expect(symbols.isAvailable()).toBe(false)
    expect(await symbols.image('star')).toBeNull()
    expect(symbols.cached('star')).toBeNull()
  })
})

describe('system services', () => {
  it('reports whether the native chrome took a change', async () => {
    const setStyle = mock(async () => undefined)
    install({ craft: { statusBar: { setStyle } } })
    expect(await statusBar.setStyle('light')).toBe(true)
    install()
    expect(await statusBar.setStyle('light')).toBe(false)
  })

  it('uses the async clipboard when the native one is refused', async () => {
    const win = install({ craft: { clipboard: { write: async () => { throw Object.assign(new Error('off'), { code: 'CAPABILITY_DISABLED' }) } } } })
    const writeText = mock(async () => {})
    Object.defineProperty(win, 'navigator', { configurable: true, value: { clipboard: { writeText, readText: async () => 'pasted' } } })
    expect(await clipboard.write('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(await clipboard.read()).toBe('pasted')
  })

  it('reads the local database natively and answers null on the web', async () => {
    install({ craft: { db: { query: async () => [{ id: 1 }], execute: async () => ({ rowsAffected: 2, lastInsertId: 9 }) } } })
    expect(await db.query('select 1')).toEqual([{ id: 1 }])
    expect(await db.execute('delete from t')).toEqual({ rowsAffected: 2, lastInsertId: 9 })
    install()
    expect(await db.query('select 1')).toBeNull()
    expect(await db.execute('delete from t')).toBeNull()
  })

  it('names quick-action symbols the way the shell reads them', async () => {
    const set = mock(async () => ({ count: 1 }))
    install({ craft: { shortcuts: { set } } })
    await shortcuts.set([{ type: 'start', title: 'Start a workout', symbol: 'figure.run' }])
    expect((set.mock.calls[0] as any)[0]).toEqual([{ type: 'start', title: 'Start a workout', iconName: 'figure.run' }])
  })

  it('treats a cancelled purchase as no purchase, and the web as nothing to buy', async () => {
    install({ craft: { iap: { purchase: async () => { throw new Error('User cancelled') }, getProducts: async () => [{ id: 'pro' }] } } })
    expect(await storeKit.purchase('pro')).toBeNull()
    expect(await storeKit.products(['pro'])).toEqual([{ id: 'pro' }] as any)
    install()
    expect(await storeKit.products(['pro'])).toEqual([])
    expect(await storeKit.purchase('pro')).toBeNull()
  })

  it('answers a dismissed scanner as no code', async () => {
    install({ craft: { scanQRCode: async () => { throw new Error('dismissed') } } })
    expect(await files.scanQRCode()).toBeNull()
  })

  it('never lets haptics reject, and wakes the engine ahead of a tap', async () => {
    const prepare = mock(async () => {})
    install({ craft: { haptics: { impact: async () => { throw new Error('boom') }, prepare } } })
    await expect(haptics.impact('light')).resolves.toBeUndefined()
    await haptics.prepare('selection')
    expect(prepare).toHaveBeenCalledWith('selection')
  })

  it('turns a DOMRect into a rectangle the bridge can carry', () => {
    expect(toNativeRect({ left: 1.2, top: 2.7, width: 10.5, height: 4 })).toEqual({ x: 1, y: 3, width: 11, height: 4 })
  })
})

describe('native events', () => {
  it('reports whether the native refresh control is there', () => {
    install({ craft: { refresh: { enable: async () => {} } } })
    expect(refresh.isAvailable()).toBe(true)
    install()
    expect(refresh.isAvailable()).toBe(false)
  })

  it('completes a silent push once its handler settles', async () => {
    const complete = mock(async () => {})
    const win = install({ craft: { background: { complete } } })
    let payload: unknown
    const stop = onSilentPush(async (data) => { payload = data })
    win.dispatchEvent(new win.CustomEvent('craftSilentPush', { detail: { payload: { kind: 'sync' } } }))
    await tick(5)
    expect(payload).toEqual({ kind: 'sync' })
    expect(complete).toHaveBeenCalledWith(true)
    stop()
  })

  it('completes a background refresh as failed when its handler throws', async () => {
    const complete = mock(async () => {})
    const win = install({ craft: { background: { complete } } })
    const stop = onBackgroundRefresh(() => { throw new Error('offline') })
    win.dispatchEvent(new win.CustomEvent('craftBackgroundRefresh'))
    await tick(5)
    expect(complete).toHaveBeenCalledWith(false)
    stop()
    expect(await background.complete(true)).toBe(true)
  })

  it('reads the appearance the shell wrote before the page ran, then follows changes', () => {
    const win = install()
    win.document.documentElement.style.setProperty('--craft-font-scale', '1.3')
    win.document.documentElement.setAttribute('data-craft-reduce-motion', 'true')
    expect(currentAppearance()).toMatchObject({ fontScale: 1.3, reduceMotion: true })
    const seen: number[] = []
    const stop = onAppearance(appearance => seen.push(appearance.fontScale))
    win.dispatchEvent(new win.CustomEvent('craftAppearance', { detail: { fontScale: 0.9, reduceMotion: false, reduceTransparency: false, colorScheme: 'dark' } }))
    stop()
    win.dispatchEvent(new win.CustomEvent('craftAppearance', { detail: { fontScale: 2 } }))
    expect(seen).toEqual([1.3, 0.9])
  })

  it('reports how long the app was away', () => {
    const win = install()
    let away = -1
    const stop = onResume(({ backgroundedMs }) => { away = backgroundedMs })
    win.dispatchEvent(new win.CustomEvent('craftResume', { detail: { backgroundedMs: 4200 } }))
    stop()
    expect(away).toBe(4200)
  })
})
