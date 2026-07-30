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

interface CraftBridge {
  window?: CraftWindowBridge
  app?: CraftAppBridge
  tray?: unknown
}

function craftBridge(): CraftBridge | undefined {
  return (globalThis as typeof globalThis & { craft?: CraftBridge }).craft
}

export function isCraftNative(): boolean {
  return craftBridge()?.window !== undefined
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
      tray: undefined,
    }
  }

  return {
    isNative: true,
    window: craft.window,
    app: craft.app,
    tray: craft.tray,
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
