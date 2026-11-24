import { nativeWindow } from '@stacksjs/desktop/browser'

const windowName = 'stacks-dashboard-settings'
const paneChannel = 'stacks.dashboard.settings-pane'
const settingsPaths = ['/settings', '/settings/appearance', '/settings/mail', '/settings/billing', '/settings/software-update']
let browserWindow: Window | null = null

export function isDashboardSettingsPath(path: string): boolean {
  return settingsPaths.includes(path.replace(/\/+$/, ''))
}

/** Return false when the link should continue through ordinary navigation. */
export function openDashboardSettings(href = '/settings'): boolean {
  let url: URL
  try {
    url = new URL(href, location.href)
  }
  catch {
    return false
  }
  if (url.origin !== location.origin || !isDashboardSettingsPath(url.pathname) || isDashboardSettingsPath(location.pathname))
    return false

  if (nativeWindow.available) {
    void nativeWindow.open({
      name: windowName,
      url: url.href,
      title: 'Stacks Settings',
      width: 746,
      height: 680,
      minWidth: 668,
      minHeight: 480,
      titlebarHidden: true,
      webWindowMaterial: true,
      chromeControls: false,
      persistentStorage: true,
    }).then(() => {
      // Craft focuses an existing named window and leaves its webview in place.
      // A pane-specific link can request a change from that existing webview.
      if (url.pathname !== '/settings' && typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(paneChannel)
        channel.postMessage(url.pathname + url.search + url.hash)
        channel.close()
      }
    })
    return true
  }

  if (!browserWindow || browserWindow.closed) {
    browserWindow = window.open(url.href, windowName, 'popup,width=746,height=680')
    if (!browserWindow)
      return false
  }
  else if (url.pathname !== '/settings') {
    // An authentication redirect can temporarily take the popup off-origin.
    // Its URL is writeable even when its current value cannot be read.
    let current: string | undefined
    try { current = browserWindow.location.href }
    catch {}
    if (current !== url.href)
      browserWindow.location.href = url.href
  }
  browserWindow.focus()
  return true
}

export function handleDashboardSettingsClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
  if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self'))
    return
  if (openDashboardSettings(link.href)) {
    event.preventDefault()
    event.stopPropagation()
  }
}

export function listenForSettingsPane(navigate: (href: string) => void): () => void {
  if (typeof BroadcastChannel === 'undefined' || !nativeWindow.available)
    return () => {}
  const channel = new BroadcastChannel(paneChannel)
  channel.onmessage = ({ data }) => {
    if (typeof data !== 'string' || !data.startsWith('/') || data.startsWith('//'))
      return
    const url = new URL(data, location.href)
    if (url.origin === location.origin && isDashboardSettingsPath(url.pathname) && url.href !== location.href)
      navigate(url.pathname + url.search + url.hash)
  }
  return () => channel.close()
}

export function listenForSettingsCommand(open: () => void): (() => void) | undefined {
  return (window as Window & { craft?: { settings?: { onOpen?: (handler: () => void) => () => void } } }).craft?.settings?.onOpen?.(open)
}

export function isNativeSettingsWindow(): boolean {
  return nativeWindow.available
}

export function dragSettingsWindow(event: MouseEvent): void {
  if (event.button === 0 && event.target === event.currentTarget)
    void nativeWindow.startDrag()
}

export function setSettingsWindowAppearance(mode: 'system' | 'light' | 'dark'): void {
  void nativeWindow.setAppearance(mode)
}

export function returnToDashboard(event: MouseEvent): void {
  if (window.opener && !window.opener.closed) {
    event.preventDefault()
    window.opener.focus()
    window.close()
  }
}
