import type { UserData } from '../../../../defaults/types/dashboard'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $user: UserData | null
    $isAuthenticated: boolean
  }
}

/**
 * Craft Bridge API Types
 * Available in native Craft environment as window.craft
 */
interface CraftWindowAPI {
  show(): Promise<void>
  hide(): Promise<void>
  toggle(): Promise<void>
  minimize(): Promise<void>
  close(): Promise<void>
}

interface CraftAppAPI {
  hideDockIcon(): Promise<void>
  showDockIcon(): Promise<void>
  quit(): Promise<void>
  notify(options: { title: string; body?: string }): Promise<void>
  getInfo(): Promise<{ name: string; version: string; platform: string }>
}

interface CraftTrayAPI {
  setTitle(title: string): Promise<void>
  setTooltip(tooltip: string): Promise<void>
  onClick(callback: (event: { button: 'left' | 'right' | 'middle' }) => void): () => void
}

interface CraftBridgeAPI {
  window?: CraftWindowAPI
  app: CraftAppAPI
  tray?: CraftTrayAPI
}

declare global {
  interface Window {
    craft?: CraftBridgeAPI
  }
}
