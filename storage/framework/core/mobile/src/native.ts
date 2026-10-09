/**
 * The rest of what Craft's iOS shell can do, typed, with a web fallback for
 * each.
 *
 * Every call reaches the native implementation when the shell has it (waiting
 * for a bridge that is still loading, see afterBridge), and otherwise does the
 * closest thing a browser can: an HTML alert for a native one, `window.open`
 * for an in-app browser, the async clipboard for the system pasteboard. What a
 * browser cannot do at all (a home screen quick action, a widget, the app's
 * own SQLite database) resolves `null` or `false` rather than throwing, so a
 * page can call it unconditionally.
 */
import type { ActionSheetOptions, AlertOptions, ConfirmOptions, ContextMenuOptions, NativeRect } from './sheets'
import { callNative, craftHost, nativeFunctionNow, onCraftEvent } from './bridge'
import { presentActionSheet, presentAlert, presentConfirm, presentContextMenu } from './sheets'

export type { ActionSheetOptions, AlertOptions, ChoiceOptions, ConfirmOptions, ContextMenuItem, ContextMenuOptions, DialogAction, DialogActionStyle, NativeRect } from './sheets'

const done = (): true => true
const no = (): false => false
const nothing = (): null => null

function hostNavigator(): Navigator | undefined {
  return craftHost()?.navigator ?? (typeof navigator === 'undefined' ? undefined : navigator)
}

/** A rectangle the bridge can serialise: getBoundingClientRect() returns a DOMRect, which it cannot. */
export function toNativeRect(rect: { x?: number, y?: number, left?: number, top?: number, width: number, height: number }): NativeRect {
  return {
    x: Math.round(rect.x ?? rect.left ?? 0),
    y: Math.round(rect.y ?? rect.top ?? 0),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

// ---------------------------------------------------------------------------
// Dialogs

export interface DialogApi {
  /** An alert with one button. Resolves once it is dismissed. */
  alert: (options: AlertOptions) => Promise<void>
  /** An alert asking yes or no. Resolves `true` when confirmed. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /**
   * An action sheet. Resolves with the chosen action's id, or null when it is
   * cancelled or dismissed (a `cancel`-styled action answers null too).
   */
  actionSheet: (options: ActionSheetOptions) => Promise<string | null>
}

export const dialog: DialogApi = {
  alert: options => callNative('dialog.alert', [options], () => presentAlert(options), { fallbackOnError: true }).then(() => {}),
  confirm: options => callNative<unknown>('dialog.confirm', [options], () => presentConfirm(options), { fallbackOnError: true }).then(Boolean),
  actionSheet: async (options) => {
    const payload = { ...options, anchor: options.anchor ? toNativeRect(options.anchor) : undefined }
    const id = await callNative<unknown>('dialog.actionSheet', [payload], () => presentActionSheet(options), { fallbackOnError: true })
    if (typeof id !== 'string') return null
    return options.actions.find(action => action.id === id)?.style === 'cancel' ? null : id
  },
}

/** Shows an action sheet: `useActionSheet()(options)`, for a page that keeps the function. */
export function useActionSheet(): (options: ActionSheetOptions) => Promise<string | null> {
  return options => dialog.actionSheet(options)
}

export interface ConfirmActionOptions extends ConfirmOptions {
  /**
   * `sheet` asks from the bottom with the action in red and Cancel apart, the
   * way iOS confirms deleting or discarding; `alert` asks in a centred alert.
   * Defaults to `sheet` for a destructive action and `alert` otherwise.
   */
  style?: 'sheet' | 'alert'
  anchor?: NativeRect
}

/**
 * Asks before doing something. `await confirmAction({ title: 'Delete this
 * workout?', confirmLabel: 'Delete', destructive: true })` raises the iOS
 * destructive-action sheet and resolves `true` when the action was chosen.
 */
export async function confirmAction(options: ConfirmActionOptions): Promise<boolean> {
  const style = options.style ?? (options.destructive ? 'sheet' : 'alert')
  if (style === 'alert') return dialog.confirm(options)
  const answer = await dialog.actionSheet({
    title: options.title,
    message: options.message,
    anchor: options.anchor,
    actions: [
      { id: 'confirm', title: options.confirmLabel || 'OK', style: options.destructive ? 'destructive' : 'default' },
      { id: 'cancel', title: options.cancelLabel || 'Cancel', style: 'cancel' },
    ],
  })
  return answer === 'confirm'
}

// ---------------------------------------------------------------------------
// Context menus

export interface ContextMenuApi {
  /** Shows a menu beside `anchor`. Resolves with the chosen item's id, or null. */
  show: (options: ContextMenuOptions) => Promise<string | null>
}

export const contextMenu: ContextMenuApi = {
  show: async (options) => {
    const payload = {
      title: options.title,
      anchor: toNativeRect(options.anchor),
      // The native menu has no use for the web's Iconify class.
      items: options.items.map(({ id, title, symbol, destructive, disabled }) => ({ id, title, symbol, destructive, disabled })),
    }
    const id = await callNative<unknown>('contextMenu.show', [payload], () => presentContextMenu(options), { fallbackOnError: true })
    return typeof id === 'string' ? id : null
  },
}

// ---------------------------------------------------------------------------
// In-app browser

export interface BrowserOpenOptions {
  /**
   * `safari` shows the page in an in-app Safari view; `auth` runs a sign-in
   * session (ASWebAuthenticationSession) that ends at `callbackScheme`.
   */
  mode?: 'safari' | 'auth'
  callbackScheme?: string
}

export interface BrowserResult {
  /** For `auth`, the callback URL the provider redirected to. */
  url?: string
  cancelled: boolean
}

export interface BrowserApi {
  open: (url: string, options?: BrowserOpenOptions) => Promise<BrowserResult>
}

function openOnTheWeb(url: string, options: BrowserOpenOptions): BrowserResult {
  const host = craftHost() as unknown as (Window & { craft?: { openURL?: (url: string) => unknown } }) | undefined
  if (!host) return { cancelled: true }
  // A shell before the in-app browser can still hand the link to Safari.
  if (typeof host.craft?.openURL === 'function') {
    void Promise.resolve(host.craft.openURL(url)).catch(() => {})
    return { cancelled: false }
  }
  // A sign-in is a redirect the page itself has to follow.
  if (options.mode === 'auth') {
    host.location?.assign(url)
    return { cancelled: false }
  }
  const opened = typeof host.open === 'function' ? host.open(url, '_blank', 'noopener') : null
  if (!opened) host.location?.assign(url)
  return { cancelled: false }
}

export const browser: BrowserApi = {
  open: async (url, options = {}) => {
    const result = await callNative<unknown>('browser.open', [url, options], () => openOnTheWeb(url, options), { fallbackOnError: true })
    if (!result || typeof result !== 'object') return { cancelled: false }
    const { url: returned, cancelled } = result as { url?: unknown, cancelled?: unknown }
    return typeof returned === 'string' ? { url: returned, cancelled: Boolean(cancelled) } : { cancelled: Boolean(cancelled) }
  },
}

// ---------------------------------------------------------------------------
// SF Symbols

export interface SymbolOptions {
  pointSize?: number
  weight?: 'ultralight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black'
  /** A CSS colour. Leave it out to draw the symbol as a mask in currentColor. */
  color?: string
  scale?: 'small' | 'medium' | 'large'
}

export interface SymbolsApi {
  /** Whether this shell can draw SF Symbols. */
  isAvailable: () => boolean
  /** The symbol rasterised as a PNG data URL, or null where there are none. Cached in memory. */
  image: (name: string, options?: SymbolOptions) => Promise<string | null>
  /** What image() has already answered, synchronously: undefined when not asked yet. */
  cached: (name: string, options?: SymbolOptions) => string | null | undefined
  clearCache: () => void
}

const symbolRequests = new Map<string, Promise<string | null>>()
const symbolImages = new Map<string, string | null>()

function symbolKey(name: string, options: SymbolOptions): string {
  return `${name}|${options.pointSize ?? ''}|${options.weight ?? ''}|${options.color ?? ''}|${options.scale ?? ''}`
}

export const symbols: SymbolsApi = {
  isAvailable: () => nativeFunctionNow('symbols.image') !== null,
  image: (name, options = {}) => {
    const key = symbolKey(name, options)
    const pending = symbolRequests.get(key)
    if (pending) return pending
    const request = callNative<unknown>('symbols.image', [name, options], nothing)
      .then(value => (typeof value === 'string' && value.startsWith('data:') ? value : null), nothing)
      .then((value) => {
        symbolImages.set(key, value)
        return value
      })
    symbolRequests.set(key, request)
    return request
  },
  cached: (name, options = {}) => symbolImages.get(symbolKey(name, options)),
  clearCache: () => {
    symbolRequests.clear()
    symbolImages.clear()
  },
}

// ---------------------------------------------------------------------------
// System chrome

export type StatusBarStyle = 'default' | 'light' | 'dark'

export interface StatusBarApi {
  /** `light` draws light text (for a dark page), `dark` dark text, `default` follows the appearance. */
  setStyle: (style: StatusBarStyle) => Promise<boolean>
}

export const statusBar: StatusBarApi = {
  setStyle: style => callNative('statusBar.setStyle', [style], no, { fallbackOnError: true }).then(result => result !== false),
}

export interface ChromeApi {
  /** The colour shown past the page's edges when it is pulled beyond its top or bottom. */
  setUnderPageColor: (color: string) => Promise<boolean>
  /** The bar iOS puts above the keyboard (previous, next, Done). */
  setKeyboardAccessory: (visible: boolean) => Promise<boolean>
}

export const chrome: ChromeApi = {
  setUnderPageColor: color => callNative('chrome.setUnderPageColor', [color], no, { fallbackOnError: true }).then(result => result !== false),
  setKeyboardAccessory: visible => callNative('chrome.setKeyboardAccessory', [visible], no, { fallbackOnError: true }).then(result => result !== false),
}

// ---------------------------------------------------------------------------
// Native pull-to-refresh

export interface RefreshApi {
  /** Whether the shell has a native refresh control for the page. */
  isAvailable: () => boolean
  /** Puts a UIRefreshControl on the page; pulls arrive through onRefresh(). */
  enable: (options?: { tintColor?: string }) => Promise<boolean>
  disable: () => Promise<boolean>
  /** Ends the spinner, once the refreshed content is in. */
  end: () => Promise<boolean>
  onRefresh: (callback: () => void) => () => void
}

export const refresh: RefreshApi = {
  isAvailable: () => nativeFunctionNow('refresh.enable') !== null,
  enable: options => callNative('refresh.enable', [options ?? {}], no, { fallbackOnError: true }).then(result => result !== false),
  disable: () => callNative('refresh.disable', [], no, { fallbackOnError: true }).then(result => result !== false),
  end: () => callNative('refresh.end', [], no, { fallbackOnError: true }).then(result => result !== false),
  onRefresh: callback => onCraftEvent('craftRefresh', () => callback()),
}

export interface BackgroundApi {
  /** Tells iOS a background refresh or silent push has been handled. */
  complete: (ok: boolean) => Promise<boolean>
}

export const background: BackgroundApi = {
  complete: ok => callNative('background.complete', [ok], no, { fallbackOnError: true }).then(result => result !== false),
}

// ---------------------------------------------------------------------------
// Clipboard

export interface ClipboardApi {
  write: (text: string) => Promise<boolean>
  read: () => Promise<string | null>
}

export const clipboard: ClipboardApi = {
  write: text => callNative('clipboard.write', [text], async () => {
    const clip = hostNavigator()?.clipboard
    if (!clip?.writeText) return false
    return clip.writeText(text).then(done, no)
  }, { fallbackOnError: true }).then(result => result !== false),
  read: () => callNative<unknown>('clipboard.read', [], async () => {
    const clip = hostNavigator()?.clipboard
    if (!clip?.readText) return null
    return clip.readText().catch(nothing)
  }, { fallbackOnError: true }).then(value => (typeof value === 'string' ? value : null)),
}

// ---------------------------------------------------------------------------
// The app's own SQLite database (Documents/craft.db)

export interface DatabaseExecuteResult {
  rowsAffected: number
  lastInsertId: number
}

export interface DatabaseApi {
  isAvailable: () => boolean
  /** Rows as objects; null where there is no local database (a browser). */
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[] | null>
  execute: (sql: string, params?: unknown[]) => Promise<DatabaseExecuteResult | null>
}

export const db: DatabaseApi = {
  isAvailable: () => nativeFunctionNow('db.query') !== null,
  query: <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    callNative<unknown>('db.query', [sql, params], nothing).then(rows => (Array.isArray(rows) ? rows as T[] : null)),
  execute: (sql, params = []) => callNative<unknown>('db.execute', [sql, params], nothing).then((result) => {
    if (!result || typeof result !== 'object') return null
    const { rowsAffected, lastInsertId } = result as Record<string, unknown>
    return { rowsAffected: Number(rowsAffected) || 0, lastInsertId: Number(lastInsertId) || 0 }
  }),
}

// ---------------------------------------------------------------------------
// Files, documents and the camera's scanner

export interface PickedFile {
  name: string
  /** The file's path on the device; absent on the web. */
  path?: string
  /** The contents as a data URL, when small enough to hand over. */
  data?: string
  mimeType?: string
}

export interface ScannedCode {
  /** The symbology, e.g. `VNBarcodeSymbologyQR`. */
  type: string
  data: string
}

export interface FilesApi {
  /** Opens a PDF in the native viewer, or a new tab on the web. */
  openPDF: (source: string, page?: number) => Promise<boolean>
  /** The screen as a PNG data URL; null on the web. */
  takeScreenshot: () => Promise<string | null>
  /** Scans one barcode or QR code; null when cancelled or unavailable. */
  scanQRCode: () => Promise<ScannedCode | null>
  /** Asks for one file. `types` are MIME types or extensions. Null when cancelled. */
  pickFile: (types?: string[]) => Promise<PickedFile | null>
  /** Saves text or a data URL into the app's documents (a download on the web). Resolves its path. */
  saveFile: (data: string, filename: string, mimeType?: string) => Promise<string | null>
  /** Downloads a URL into the app's documents (a download on the web). Resolves its path. */
  downloadFile: (url: string, filename: string) => Promise<string | null>
}

function downloadOnTheWeb(href: string, filename: string): string | null {
  const doc = craftHost()?.document
  if (!doc?.body) return null
  const link = doc.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  doc.body.appendChild(link)
  link.click()
  link.remove()
  return filename
}

function pickOnTheWeb(types: string[]): Promise<PickedFile | null> {
  const doc = craftHost()?.document
  if (!doc?.body) return Promise.resolve(null)
  return new Promise((resolve) => {
    const input = doc.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    if (types.length) input.accept = types.map(type => (type.includes('/') || type.startsWith('.') ? type : `.${type}`)).join(',')
    const finish = (value: PickedFile | null): void => {
      input.remove()
      resolve(value)
    }
    input.addEventListener('cancel', () => finish(null))
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return finish(null)
      const reader = new FileReader()
      reader.onload = () => finish({ name: file.name, mimeType: file.type || undefined, data: typeof reader.result === 'string' ? reader.result : undefined })
      reader.onerror = () => finish({ name: file.name, mimeType: file.type || undefined })
      reader.readAsDataURL(file)
    })
    doc.body.appendChild(input)
    input.click()
  })
}

export const files: FilesApi = {
  openPDF: (source, page = 0) => callNative('openPDF', [source, page], () => {
    const host = craftHost() as unknown as Window | undefined
    return Boolean(host?.open?.(source, '_blank', 'noopener'))
  }).then(result => result !== false),
  takeScreenshot: () => callNative<unknown>('takeScreenshot', [], nothing, { fallbackOnError: true })
    .then(value => (typeof value === 'string' ? value : null)),
  // A dismissed scanner or picker rejects natively; to a page that is no answer.
  scanQRCode: () => callNative<unknown>('scanQRCode', [], nothing).then((value) => {
    if (!value || typeof value !== 'object') return null
    const { type, data } = value as Record<string, unknown>
    return typeof data === 'string' ? { type: String(type ?? ''), data } : null
  }, nothing),
  pickFile: (types = []) => callNative<unknown>('pickFile', [types], () => pickOnTheWeb(types)).then((value) => {
    if (!value || typeof value !== 'object') return null
    const file = value as Record<string, unknown>
    if (typeof file.name !== 'string') return null
    return {
      name: file.name,
      path: typeof file.path === 'string' ? file.path : undefined,
      data: typeof file.data === 'string' ? file.data : undefined,
      mimeType: typeof file.mimeType === 'string' ? file.mimeType : undefined,
    }
  }, nothing),
  saveFile: (data, filename, mimeType) => callNative<unknown>('saveFile', [data, filename, mimeType], () => {
    if (data.startsWith('data:')) return downloadOnTheWeb(data, filename)
    const blob = new Blob([data], { type: mimeType || 'text/plain' })
    const url = URL.createObjectURL(blob)
    const saved = downloadOnTheWeb(url, filename)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return saved
  }).then(value => (typeof value === 'string' ? value : null)),
  downloadFile: (url, filename) => callNative<unknown>('downloadFile', [url, filename], () => downloadOnTheWeb(url, filename))
    .then(value => (typeof value === 'string' ? value : null)),
}

// ---------------------------------------------------------------------------
// Home screen quick actions

export interface HomeScreenShortcut {
  /** What comes back in onShortcut() when it is chosen. */
  type: string
  title: string
  subtitle?: string
  /** An SF Symbol name. */
  symbol?: string
  userInfo?: Record<string, string>
}

export interface ShortcutsApi {
  /** Replaces the app icon's long-press quick actions. */
  set: (shortcuts: HomeScreenShortcut[]) => Promise<boolean>
  clear: () => Promise<boolean>
  onShortcut: (callback: (type: string) => void) => () => void
}

export const shortcuts: ShortcutsApi = {
  set: list => callNative('shortcuts.set', [list.map(({ symbol, ...shortcut }) => (symbol ? { ...shortcut, iconName: symbol } : shortcut))], no)
    .then(result => result !== false),
  clear: () => callNative('shortcuts.clear', [], no).then(result => result !== false),
  onShortcut: callback => onCraftEvent<{ type?: unknown }>('craftShortcut', (detail) => {
    if (typeof detail.type === 'string') callback(detail.type)
  }),
}

// ---------------------------------------------------------------------------
// Home screen widgets (WidgetKit)

export interface WidgetsApi {
  /** Hands the widget extension its data (shared through the app group) and reloads it. */
  update: (data: Record<string, unknown>) => Promise<boolean>
  reload: () => Promise<boolean>
}

export const widgets: WidgetsApi = {
  update: data => callNative('widget.update', [data], no).then(result => result !== false),
  reload: () => callNative('widget.reload', [], no).then(result => result !== false),
}

// ---------------------------------------------------------------------------
// Orientation

export type OrientationLock = 'portrait' | 'portraitUpsideDown' | 'landscape' | 'landscapeLeft' | 'landscapeRight'

export interface OrientationApi {
  lock: (orientation: OrientationLock) => Promise<boolean>
  unlock: () => Promise<boolean>
}

const WEB_ORIENTATIONS: Record<OrientationLock, string> = {
  portrait: 'portrait-primary',
  portraitUpsideDown: 'portrait-secondary',
  landscape: 'landscape',
  landscapeLeft: 'landscape-primary',
  landscapeRight: 'landscape-secondary',
}

interface LockableOrientation { lock?: (orientation: string) => Promise<void>, unlock?: () => void }

function screenOrientation(): LockableOrientation | undefined {
  const host = craftHost() as unknown as { screen?: { orientation?: LockableOrientation } } | undefined
  return host?.screen?.orientation
}

export const orientation: OrientationApi = {
  lock: value => callNative('lockOrientation', [value], () => {
    const screen = screenOrientation()
    return screen?.lock ? screen.lock(WEB_ORIENTATIONS[value]).then(done, no) : false
  }).then(result => result !== false),
  unlock: () => callNative('unlockOrientation', [], () => {
    screenOrientation()?.unlock?.()
    return true
  }).then(result => result !== false),
}

// ---------------------------------------------------------------------------
// Sign in with Apple

export interface AppleSignInResult {
  userId: string
  email?: string
  name?: string
  /** The JWT to verify on the server. */
  identityToken?: string
  authorizationCode?: string
}

export interface AuthApi {
  /** Null on the web, where the app should offer Apple's JS flow instead. */
  signInWithApple: () => Promise<AppleSignInResult | null>
}

export const auth: AuthApi = {
  signInWithApple: () => callNative<unknown>('signInWithApple', [], nothing).then((value) => {
    if (!value || typeof value !== 'object' || typeof (value as { userId?: unknown }).userId !== 'string') return null
    return value as AppleSignInResult
  }),
}

// ---------------------------------------------------------------------------
// In-app purchase (StoreKit 2)

export interface StoreProduct {
  id: string
  displayName: string
  description: string
  price: string
  displayPrice: string
}

export interface StoreTransaction {
  transactionId: string
  productId: string
}

export interface StoreKitApi {
  isAvailable: () => boolean
  /** The App Store's products for these ids; empty on the web. */
  products: (ids: string[]) => Promise<StoreProduct[]>
  /** Buys a product. Null when the person cancels, or on the web. */
  purchase: (id: string) => Promise<StoreTransaction | null>
  /** The person's current entitlements, after syncing with the App Store. */
  restore: () => Promise<StoreTransaction[]>
}

export const storeKit: StoreKitApi = {
  isAvailable: () => nativeFunctionNow('iap.purchase') !== null,
  products: ids => callNative<unknown>('iap.getProducts', [ids], () => []).then(value => (Array.isArray(value) ? value as StoreProduct[] : [])),
  purchase: id => callNative<unknown>('iap.purchase', [id], nothing).then(
    value => (value && typeof value === 'object' ? value as StoreTransaction : null),
    (error: unknown) => {
      // Cancelling is an answer, not a failure.
      if (/cancel/i.test(String((error as Error)?.message ?? error))) return null
      throw error
    },
  ),
  restore: () => callNative<unknown>('iap.restore', [], () => []).then(value => (Array.isArray(value) ? value as StoreTransaction[] : [])),
}
