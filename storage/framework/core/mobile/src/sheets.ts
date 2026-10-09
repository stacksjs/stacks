/**
 * The web's stand-ins for iOS alerts, action sheets and context menus.
 *
 * Inside a Craft shell that has the native dialogs these never draw: the
 * phone's own UIAlertController and UIMenu do. In a browser, and on a shell
 * that predates them, a page still gets something that looks and behaves like
 * them rather than `window.confirm()`: an alert centred over a dimmed page, an
 * action sheet raised from the bottom with Cancel set apart, a menu over a
 * blurred page. Each is built on demand, focus-trapped, dismissed with
 * Escape, and gone from the document once answered.
 *
 * Styles are injected once, themed by the same `--native-*` custom properties
 * as the Native components, dark under the `.dark` class.
 */
import { craftHost } from './bridge'

export type DialogActionStyle = 'default' | 'destructive' | 'cancel'

export interface DialogAction {
  id: string
  title: string
  style?: DialogActionStyle
}

/** A rectangle in CSS pixels relative to the viewport, as getBoundingClientRect() reports. */
export interface NativeRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ChoiceOptions {
  /** `alert` is centred, iOS's UIAlertController alert; `sheet` rises from the bottom. */
  variant: 'alert' | 'sheet'
  title?: string
  message?: string
  actions: DialogAction[]
  /** The label of the Cancel a sheet adds when its actions have none. */
  cancelLabel?: string
}

export interface ContextMenuItem {
  id: string
  title: string
  /** An SF Symbol for the native menu. */
  symbol?: string
  /** An Iconify class for the web menu, which cannot draw SF Symbols. */
  icon?: string
  destructive?: boolean
  disabled?: boolean
}

export interface ContextMenuOptions {
  items: ContextMenuItem[]
  /** The pressed element's rectangle: the menu opens beside it. */
  anchor: NativeRect
  title?: string
}

const STYLE_ID = 'native-dialog-styles'

const STYLES = `
.native-dialog { position: fixed; inset: 0; z-index: 2147483000; font-size: var(--native-font-size, 17px); font-family: var(--native-font-family, -apple-system, system-ui, sans-serif); -webkit-tap-highlight-color: transparent; }
.native-dialog-backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / 0.3); opacity: 0; transition: opacity 220ms ease; }
.native-dialog--menu .native-dialog-backdrop { background: rgb(0 0 0 / 0.12); -webkit-backdrop-filter: blur(14px) saturate(140%); backdrop-filter: blur(14px) saturate(140%); }
.native-dialog.is-open .native-dialog-backdrop { opacity: 1; }
.native-dialog-panel { position: absolute; outline: none; }
.native-dialog--sheet .native-dialog-panel { right: 0; bottom: 0; left: 0; display: flex; flex-direction: column; gap: 0.47em; max-width: 32rem; margin: 0 auto; padding: 0 0.47em calc(0.47em + env(safe-area-inset-bottom, 0px)); transform: translateY(110%); transition: transform 380ms cubic-bezier(0.32, 0.72, 0, 1); }
.native-dialog--sheet.is-open .native-dialog-panel { transform: none; }
.native-dialog--alert .native-dialog-panel { top: 50%; left: 50%; width: min(16.5em, calc(100vw - 3rem)); transform: translate(-50%, -50%) scale(1.12); opacity: 0; transition: transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1.05), opacity 200ms ease; }
.native-dialog--alert.is-open .native-dialog-panel { transform: translate(-50%, -50%); opacity: 1; }
.native-dialog-group { overflow: hidden; border-radius: 0.8em; background: var(--native-dialog-background, rgb(242 242 247 / 0.92)); -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%); }
.native-dialog-header { padding: 0.85em 1em; text-align: center; }
.native-dialog--sheet .native-dialog-header { border-bottom: 0.5px solid var(--native-separator, rgb(60 60 67 / 0.29)); }
.native-dialog-title { margin: 0; font-size: 0.765em; font-weight: 600; color: var(--native-secondary-label, rgb(60 60 67 / 0.6)); }
.native-dialog--alert .native-dialog-title { font-size: 1em; color: inherit; }
.native-dialog-message { margin: 0.25em 0 0; font-size: 0.765em; color: var(--native-secondary-label, rgb(60 60 67 / 0.6)); }
.native-dialog--alert .native-dialog-message { color: inherit; }
.native-dialog-actions { display: flex; flex-direction: column; }
.native-dialog--alert .native-dialog-actions { border-top: 0.5px solid var(--native-separator, rgb(60 60 67 / 0.29)); }
.native-dialog--alert .native-dialog-actions.is-row { flex-direction: row; }
.native-dialog-action { min-height: 3.3em; padding: 0 1em; border: 0; border-top: 0.5px solid var(--native-separator, rgb(60 60 67 / 0.29)); color: var(--native-accent, rgb(0 122 255)); background: transparent; font: inherit; font-size: 1.18em; cursor: pointer; }
.native-dialog--alert .native-dialog-action { min-height: 2.6em; font-size: 1em; }
.native-dialog-action:first-child { border-top: 0; }
.native-dialog-actions.is-row .native-dialog-action { flex: 1; border-top: 0; border-left: 0.5px solid var(--native-separator, rgb(60 60 67 / 0.29)); }
.native-dialog-actions.is-row .native-dialog-action:first-child { border-left: 0; }
.native-dialog-action.is-cancel { font-weight: 600; }
.native-dialog-action.is-destructive { color: var(--native-destructive, rgb(255 59 48)); }
.native-dialog-action:active, .native-dialog-action:focus-visible { background: var(--native-pressed, rgb(0 0 0 / 0.08)); outline: none; }
.native-menu { position: absolute; width: min(15.5em, calc(100vw - 1.5rem)); overflow: hidden; border-radius: 0.8em; background: var(--native-dialog-background, rgb(242 242 247 / 0.92)); box-shadow: 0 10px 40px rgb(0 0 0 / 0.2); -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%); transform: scale(0.6); transform-origin: var(--native-menu-origin, top left); opacity: 0; transition: transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1), opacity 160ms ease; }
.native-dialog.is-open .native-menu { transform: none; opacity: 1; }
.native-menu-title { margin: 0; padding: 0.6em 1em; border-bottom: 0.5px solid var(--native-separator, rgb(60 60 67 / 0.29)); font-size: 0.765em; color: var(--native-secondary-label, rgb(60 60 67 / 0.6)); }
.native-menu-item { display: flex; gap: 0.75em; align-items: center; justify-content: space-between; width: 100%; min-height: 2.6em; padding: 0 1em; border: 0; border-top: 0.5px solid var(--native-separator, rgb(60 60 67 / 0.29)); color: inherit; background: transparent; font: inherit; text-align: left; cursor: pointer; }
.native-menu-item:first-of-type { border-top: 0; }
.native-menu-item.is-destructive { color: var(--native-destructive, rgb(255 59 48)); }
.native-menu-item:disabled { opacity: 0.35; }
.native-menu-item:active, .native-menu-item:focus-visible { background: var(--native-pressed, rgb(0 0 0 / 0.08)); outline: none; }
.native-menu-icon { flex-shrink: 0; width: 1.1em; height: 1.1em; }
.dark .native-dialog-group, .dark .native-menu { background: var(--native-dialog-background-dark, rgb(44 44 46 / 0.9)); color: rgb(255 255 255); }
.dark .native-dialog-action { color: var(--native-accent-dark, rgb(10 132 255)); }
.dark .native-dialog-action.is-destructive, .dark .native-menu-item.is-destructive { color: var(--native-destructive-dark, rgb(255 69 58)); }
.dark .native-dialog-title, .dark .native-dialog-message, .dark .native-menu-title { color: rgb(235 235 245 / 0.6); }
.dark .native-dialog--alert .native-dialog-title, .dark .native-dialog--alert .native-dialog-message { color: rgb(255 255 255); }
.dark .native-dialog-action, .dark .native-menu-item, .dark .native-dialog-header, .dark .native-menu-title, .dark .native-dialog-actions { border-color: rgb(84 84 88 / 0.6); }
.dark .native-dialog-action:active, .dark .native-menu-item:active { background: rgb(255 255 255 / 0.1); }
@media (prefers-reduced-motion: reduce) {
  .native-dialog-backdrop, .native-dialog-panel, .native-menu { transition: opacity 150ms ease; }
  .native-dialog--sheet .native-dialog-panel, .native-dialog--alert .native-dialog-panel, .native-menu { transform: none; }
  .native-dialog--alert .native-dialog-panel { transform: translate(-50%, -50%); }
}
:root[data-native-reduce-motion] .native-dialog--sheet .native-dialog-panel, :root[data-native-reduce-motion] .native-menu { transform: none; transition: opacity 150ms ease; }
@media (prefers-reduced-transparency: reduce) {
  .native-dialog-group, .native-menu { -webkit-backdrop-filter: none; backdrop-filter: none; background: var(--native-dialog-solid, rgb(242 242 247)); }
  .dark .native-dialog-group, .dark .native-menu { background: var(--native-dialog-solid-dark, rgb(44 44 46)); }
}
`

function currentDocument(): Document | undefined {
  return craftHost()?.document
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLES
  ;(doc.head ?? doc.documentElement).appendChild(style)
}

let nextId = 0

function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps Tab and Shift+Tab inside `container`: called from a keydown listener,
 * it moves focus from one end to the other instead of out of it.
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  const active = container.ownerDocument.activeElement
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}

interface Overlay {
  root: HTMLElement
  panel: HTMLElement
  settle: (value: string | null) => void
}

/**
 * Mounts an overlay and resolves with whatever settles it, after taking it out
 * of the document again (once its closing transition has had its time).
 */
function overlay(doc: Document, variant: string, build: (overlay: Omit<Overlay, 'panel'>) => HTMLElement, onEscape: () => string | null): Promise<string | null> {
  ensureStyles(doc)
  const host = craftHost()
  const previousFocus = doc.activeElement as HTMLElement | null
  const root = element(doc, 'div', `native-dialog native-dialog--${variant}`)
  root.setAttribute('data-native-dialog', variant)
  root.appendChild(element(doc, 'div', 'native-dialog-backdrop'))

  return new Promise<string | null>((resolve) => {
    let settled = false
    const settle = (value: string | null): void => {
      if (settled) return
      settled = true
      root.classList.remove('is-open')
      doc.removeEventListener('keydown', onKey, true)
      const remove = (): void => {
        root.remove()
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus()
      }
      setTimeout(remove, 260)
      resolve(value)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        settle(onEscape())
        return
      }
      trapFocus(panel, event)
    }

    const panel = build({ root, settle })
    root.appendChild(panel)
    doc.body.appendChild(root)
    doc.addEventListener('keydown', onKey, true)

    // Two frames: the closed state has to be drawn once for the opening to animate from it.
    const view = host as unknown as Partial<Window> | undefined
    const frame = typeof view?.requestAnimationFrame === 'function'
      ? (run: () => void) => view.requestAnimationFrame!(() => view.requestAnimationFrame!(run))
      : (run: () => void) => setTimeout(run, 16)
    frame(() => {
      if (!settled) root.classList.add('is-open')
    })
    const first = panel.querySelector<HTMLElement>('[data-native-autofocus]') ?? panel.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
  })
}

/**
 * An alert or action sheet drawn in HTML. Resolves with the chosen action's
 * id, or null when it is dismissed or Cancel is chosen.
 */
export function presentChoice(options: ChoiceOptions): Promise<string | null> {
  const doc = currentDocument()
  if (!doc?.body) return Promise.resolve(null)
  const id = `native-dialog-${++nextId}`
  const cancel = options.actions.find(action => action.style === 'cancel')
  const actions = options.variant === 'sheet'
    ? options.actions.filter(action => action.style !== 'cancel')
    : options.actions
  const cancelAction: DialogAction | undefined = options.variant === 'sheet'
    ? (cancel ?? { id: '__cancel', title: options.cancelLabel || 'Cancel', style: 'cancel' })
    : undefined

  return overlay(doc, options.variant, ({ root, settle }) => {
    const answer = (action: DialogAction): string | null => action.style === 'cancel' ? null : action.id
    const panel = element(doc, 'div', 'native-dialog-panel')
    panel.setAttribute('role', 'alertdialog')
    panel.setAttribute('aria-modal', 'true')
    panel.tabIndex = -1

    const group = element(doc, 'div', 'native-dialog-group')
    if (options.title || options.message) {
      const header = element(doc, 'div', 'native-dialog-header')
      if (options.title) {
        const title = element(doc, 'p', 'native-dialog-title', options.title)
        title.id = `${id}-title`
        header.appendChild(title)
        panel.setAttribute('aria-labelledby', title.id)
      }
      if (options.message) {
        const message = element(doc, 'p', 'native-dialog-message', options.message)
        message.id = `${id}-message`
        header.appendChild(message)
        panel.setAttribute('aria-describedby', message.id)
      }
      group.appendChild(header)
    }

    const list = element(doc, 'div', 'native-dialog-actions')
    // Two buttons side by side, as iOS lays out a two-choice alert.
    if (options.variant === 'alert' && actions.length === 2) list.classList.add('is-row')
    for (const action of actions) {
      const button = element(doc, 'button', `native-dialog-action${action.style === 'destructive' ? ' is-destructive' : ''}${action.style === 'cancel' ? ' is-cancel' : ''}`, action.title)
      button.type = 'button'
      button.setAttribute('data-action-id', action.id)
      button.addEventListener('click', () => settle(answer(action)))
      list.appendChild(button)
    }
    group.appendChild(list)
    panel.appendChild(group)

    if (cancelAction) {
      const cancelGroup = element(doc, 'div', 'native-dialog-group')
      const button = element(doc, 'button', 'native-dialog-action is-cancel', cancelAction.title)
      button.type = 'button'
      button.setAttribute('data-action-id', cancelAction.id)
      button.addEventListener('click', () => settle(null))
      cancelGroup.appendChild(button)
      panel.appendChild(cancelGroup)
    }

    // A sheet goes away when the page behind it is tapped; an alert waits
    // for an answer, as on iOS.
    const backdrop = root.querySelector('.native-dialog-backdrop')
    if (options.variant === 'sheet') backdrop?.addEventListener('click', () => settle(null))
    return panel
  }, () => {
    if (options.variant === 'sheet') return null
    // Escape on an alert answers its cancel, or its only button.
    if (cancel) return null
    return actions.length === 1 ? actions[0]!.id : null
  })
}

export interface AlertOptions {
  title: string
  message?: string
  okLabel?: string
}

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** The confirming action deletes or discards: drawn in red. */
  destructive?: boolean
}

export interface ActionSheetOptions {
  title?: string
  message?: string
  actions: DialogAction[]
  /** Where an iPad anchors the popover; the pressed element's rectangle. */
  anchor?: NativeRect
  /** The label of the Cancel the web sheet adds when the actions have none. */
  cancelLabel?: string
}

export async function presentAlert(options: AlertOptions): Promise<void> {
  await presentChoice({ variant: 'alert', title: options.title, message: options.message, actions: [{ id: 'ok', title: options.okLabel || 'OK' }] })
}

export async function presentConfirm(options: ConfirmOptions): Promise<boolean> {
  const answer = await presentChoice({
    variant: 'alert',
    title: options.title,
    message: options.message,
    actions: [
      { id: 'cancel', title: options.cancelLabel || 'Cancel', style: 'cancel' },
      { id: 'confirm', title: options.confirmLabel || 'OK', style: options.destructive ? 'destructive' : 'default' },
    ],
  })
  return answer === 'confirm'
}

export function presentActionSheet(options: ActionSheetOptions): Promise<string | null> {
  return presentChoice({ variant: 'sheet', title: options.title, message: options.message, actions: options.actions, cancelLabel: options.cancelLabel })
}

/** Where a menu of `size` opens beside `anchor` within a `viewport`, 12px clear of its edges. */
export function placeMenu(anchor: NativeRect, size: { width: number, height: number }, viewport: { width: number, height: number }): { top: number, left: number, origin: string } {
  const margin = 12
  const gap = 8
  const left = Math.max(margin, Math.min(anchor.x, viewport.width - size.width - margin))
  const below = anchor.y + anchor.height + gap
  const fitsBelow = below + size.height <= viewport.height - margin
  const above = anchor.y - gap - size.height
  const top = fitsBelow || above < margin
    ? Math.max(margin, Math.min(below, viewport.height - size.height - margin))
    : above
  const horizontal = anchor.x + anchor.width / 2 > viewport.width / 2 ? 'right' : 'left'
  return { top, left, origin: `${fitsBelow || above < margin ? 'top' : 'bottom'} ${horizontal}` }
}

/**
 * A context menu drawn in HTML over a blurred page, beside the element that
 * was pressed. Resolves with the chosen item's id, or null when dismissed.
 */
export function presentContextMenu(options: ContextMenuOptions): Promise<string | null> {
  const doc = currentDocument()
  if (!doc?.body) return Promise.resolve(null)
  const host = craftHost() as unknown as { innerWidth?: number, innerHeight?: number } | undefined

  return overlay(doc, 'menu', ({ root, settle }) => {
    const menu = element(doc, 'div', 'native-menu native-dialog-panel')
    menu.setAttribute('role', 'menu')
    if (options.title) {
      menu.appendChild(element(doc, 'p', 'native-menu-title', options.title))
      menu.setAttribute('aria-label', options.title)
    }
    for (const item of options.items) {
      const button = element(doc, 'button', `native-menu-item${item.destructive ? ' is-destructive' : ''}`)
      button.type = 'button'
      button.setAttribute('role', 'menuitem')
      button.setAttribute('data-action-id', item.id)
      if (item.disabled) button.disabled = true
      button.appendChild(element(doc, 'span', 'native-menu-label', item.title))
      if (item.icon) {
        const icon = element(doc, 'i', `native-menu-icon ${item.icon}`)
        icon.setAttribute('aria-hidden', 'true')
        button.appendChild(icon)
      }
      button.addEventListener('click', () => settle(item.id))
      menu.appendChild(button)
    }
    root.querySelector('.native-dialog-backdrop')?.addEventListener('click', () => settle(null))

    // Measured once in the document; until then a menu has no size.
    queueMicrotask(() => {
      const rect = menu.getBoundingClientRect?.()
      const place = placeMenu(options.anchor, { width: rect?.width || 248, height: rect?.height || options.items.length * 44 }, {
        width: host?.innerWidth || 390,
        height: host?.innerHeight || 844,
      })
      menu.style.top = `${place.top}px`
      menu.style.left = `${place.left}px`
      menu.style.setProperty('--native-menu-origin', place.origin)
    })
    return menu
  }, () => null)
}
