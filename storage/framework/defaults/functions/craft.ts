/**
 * Craft Native App Composable
 *
 * Provides utilities for interacting with the Craft native app environment.
 * These functions are safe to call in both web and native environments.
 */

/**
 * Check if running in Craft native environment
 */
interface CraftWindowBridge {
  minimize: () => void | Promise<void>
  close: () => void | Promise<void>
  toggle: () => void | Promise<void>
  show: () => void | Promise<void>
  hide: () => void | Promise<void>
}

interface CraftAppInfo {
  name: string
  version: string
  platform: string
}

interface CraftAppBridge {
  quit: () => void | Promise<void>
  notify: (options: { title: string, body?: string }) => void | Promise<void>
  getInfo: () => CraftAppInfo | Promise<CraftAppInfo>
}

export interface CraftSidebarSelectEvent {
  itemId: string
  sectionId?: string
  item?: {
    id?: string
    label?: string
    href?: string
  }
  data?: Record<string, unknown>
}

interface CraftSidebarBridge {
  onSelect?: (callback: (event: CraftSidebarSelectEvent) => void) => (() => void) | void
}

interface CraftBridge {
  window?: CraftWindowBridge
  app?: CraftAppBridge
  sidebar?: CraftSidebarBridge
  tray?: unknown
  _sidebarSelectHandler?: (event: CraftSidebarSelectEvent) => void
}

interface CraftRuntime {
  craft?: CraftBridge
  __craftNativeSidebar?: boolean
  location?: { search?: string }
  document?: { documentElement?: { setAttribute: (name: string, value: string) => void } }
}

function craftRuntime(): CraftRuntime {
  return globalThis as typeof globalThis & CraftRuntime
}

function craftBridge(): CraftBridge | undefined {
  return craftRuntime().craft
}

export function isCraftNative(): boolean {
  return craftBridge()?.window !== undefined
}

/**
 * Keep the native-sidebar marker consistent across current Craft builds,
 * older bootstraps that only expose `__craftNativeSidebar`, and URL mode.
 *
 * Current Craft sets `data-craft-native-sidebar` before the document loads.
 * The fallback remains here so apps launched by an older installed binary
 * still receive the same CSS contract without embedding raw browser scripts
 * in STX components.
 */
export function ensureCraftNativeSidebarMarker(): boolean {
  const runtime = craftRuntime()
  const search = runtime.location?.search || ''
  const hasQueryFlag = new URLSearchParams(search).get('native-sidebar') === '1'
  const hasNativeSidebar = runtime.__craftNativeSidebar === true || hasQueryFlag

  if (hasNativeSidebar) {
    runtime.__craftNativeSidebar = true
    runtime.document?.documentElement?.setAttribute('data-craft-native-sidebar', 'true')
  }

  return hasNativeSidebar
}

/**
 * Get the Craft bridge API (returns undefined in web environment)
 */
export function useCraft() {
  const craft = craftBridge()
  if (!craft?.window) {
    return {
      isNative: false,
      window: undefined,
      app: undefined,
      sidebar: undefined,
      tray: undefined,
    }
  }

  return {
    isNative: true,
    window: craft.window,
    app: craft.app,
    sidebar: craft.sidebar,
    tray: craft.tray,
  }
}

/**
 * Subscribe to Craft's native sidebar selection bridge.
 *
 * Current Craft builds expose `sidebar.onSelect`. Older native-sidebar
 * bootstraps dispatch through `_sidebarSelectHandler`; keeping that protocol
 * inside this composable prevents STX templates from reaching into globals.
 */
export function useCraftSidebarSelection(
  handler: (event: CraftSidebarSelectEvent) => void,
): () => void {
  const craft = craftBridge()
  if (!craft) return () => {}

  if (craft.sidebar?.onSelect) {
    const unsubscribe = craft.sidebar.onSelect(handler)
    return typeof unsubscribe === 'function' ? unsubscribe : () => {}
  }

  const previousHandler = craft._sidebarSelectHandler
  craft._sidebarSelectHandler = handler

  return () => {
    if (craft._sidebarSelectHandler === handler)
      craft._sidebarSelectHandler = previousHandler
  }
}

/**
 * Window control functions that work in both web and native environments
 */
export function useWindowControls() {
  const { isNative, window: craftWindow } = useCraft()

  return {
    isNative,

    minimize: async () => {
      if (isNative && craftWindow) {
        await craftWindow.minimize()
      }
    },

    close: async () => {
      if (isNative && craftWindow) {
        await craftWindow.close()
      }
    },

    toggle: async () => {
      if (isNative && craftWindow) {
        await craftWindow.toggle()
      }
    },

    show: async () => {
      if (isNative && craftWindow) {
        await craftWindow.show()
      }
    },

    hide: async () => {
      if (isNative && craftWindow) {
        await craftWindow.hide()
      }
    },
  }
}

/**
 * App control functions
 */
export function useAppControls() {
  const { isNative, app } = useCraft()

  return {
    isNative,

    quit: async () => {
      if (isNative && app) {
        await app.quit()
      }
    },

    notify: async (title: string, body?: string) => {
      if (isNative && app) {
        await app.notify({ title, body })
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body })
      }
    },

    getInfo: async () => {
      if (isNative && app) {
        return app.getInfo()
      }
      return { name: 'Stacks Dashboard', version: '0.0.0', platform: 'web' }
    },
  }
}
