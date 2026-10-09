/**
 * Keeping the native chrome around the page in step with it: the colour iOS
 * shows past the page's edges, the status bar's text, the keyboard's
 * accessory bar, and the phone's accessibility settings as attributes the
 * stylesheets can read. NativeAppShell installs it once the page is known to
 * be in the phone app.
 */
import type { NativeAppearance } from './events'
import { onAppearance } from './events'
import { chrome, statusBar } from './native'

/** Writes an appearance where CSS can read it: `--native-font-scale` and `data-native-reduce-*`. */
export function applyAppearance(root: HTMLElement, appearance: NativeAppearance): void {
  root.style.setProperty('--native-font-scale', String(appearance.fontScale))
  root.toggleAttribute('data-native-reduce-motion', appearance.reduceMotion)
  root.toggleAttribute('data-native-reduce-transparency', appearance.reduceTransparency)
}

function transparent(color: string): boolean {
  const value = color.replace(/\s+/g, '').toLowerCase()
  return !value || value === 'transparent' || /^rgba\(\d+,\d+,\d+,0(\.0+)?\)$/.test(value) || /\/0(\.0+)?\)$/.test(value)
}

/**
 * The colour behind the page: the first opaque background of the body or the
 * root element. The under-page area should read as more of the page when it
 * is pulled past its top or bottom, not as a white or black band.
 */
export function pageBackground(doc: Document): string | null {
  const view = doc.defaultView
  if (!view?.getComputedStyle) return null
  for (const element of [doc.body, doc.documentElement]) {
    if (!element) continue
    const color = view.getComputedStyle(element).backgroundColor
    if (color && !transparent(color)) return color
  }
  return null
}

/** Whether the page draws dark: the `.dark` class, or the system's preference where the app follows it. */
export function pageIsDark(doc: Document): boolean {
  if (doc.documentElement.classList.contains('dark')) return true
  if (doc.documentElement.classList.contains('light')) return false
  return Boolean(doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches)
}

export interface NativeChromeOptions {
  /** Where the appearance attributes go. The root element by default. */
  root?: HTMLElement
  /** Leave the keyboard's previous/next/Done bar on. Off by default, as in native apps. */
  keyboardAccessory?: boolean
}

/**
 * Keeps the native chrome in step with the page until the returned function
 * is called: on install, whenever the colour scheme flips (the `.dark` class
 * or the system's), after each navigation, and on every appearance change.
 */
export function installNativeChrome(doc: Document, options: NativeChromeOptions = {}): () => void {
  const root = options.root ?? doc.documentElement
  void chrome.setKeyboardAccessory(options.keyboardAccessory === true)

  let lastColor = ''
  let lastStyle = ''
  const sync = (): void => {
    const color = pageBackground(doc)
    if (color && color !== lastColor) {
      lastColor = color
      void chrome.setUnderPageColor(color)
    }
    // Light text on a dark page, dark text on a light one.
    const style = pageIsDark(doc) ? 'light' : 'dark'
    if (style !== lastStyle) {
      lastStyle = style
      void statusBar.setStyle(style)
    }
  }

  const stopAppearance = onAppearance((appearance) => {
    applyAppearance(root, appearance)
    sync()
  })

  const view = doc.defaultView
  const observer = typeof view?.MutationObserver === 'function' ? new view.MutationObserver(sync) : null
  observer?.observe(doc.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
  const scheme = view?.matchMedia?.('(prefers-color-scheme: dark)')
  scheme?.addEventListener?.('change', sync)
  view?.addEventListener('stx:load', sync)
  sync()

  return () => {
    stopAppearance()
    observer?.disconnect()
    scheme?.removeEventListener?.('change', sync)
    view?.removeEventListener('stx:load', sync)
  }
}
