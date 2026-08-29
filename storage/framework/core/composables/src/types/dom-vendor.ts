/**
 * Browser APIs lib.dom does not declare.
 *
 * Vendor-prefixed fullscreen, which Safari still ships under `webkit`, and two
 * APIs that are real but not yet in the standard lib types: the EyeDropper
 * picker and Network Information. Each was reached through a
 * `(document)` / `(navigator)` / `(window)` cast, which
 * hides which member is being probed - a misspelt one reads as `undefined` and
 * the feature-detection beside it quietly concludes "unsupported".
 *
 * A module with `declare global` rather than an ambient `.d.ts`: the ambient
 * form declares a SECOND `Document` here instead of merging with lib.dom's, so
 * the members landed on a type nothing uses. Files that need these import it.
 */

export interface EyeDropperInstance {
  open: (_options?: { signal?: AbortSignal }) => Promise<{ sRGBHex: string }>
}

export interface NetworkInformationLike {
  downlink?: number
  downlinkMax?: number
  effectiveType?: string
  rtt?: number
  saveData?: boolean
  type?: string
  addEventListener?: (_type: string, _listener: () => void) => void
  removeEventListener?: (_type: string, _listener: () => void) => void
}

declare global {
  interface Document {
    webkitFullscreenElement?: Element | null
    webkitExitFullscreen?: () => Promise<void> | void
  }

  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void> | void
  }

  interface Navigator {
    connection?: NetworkInformationLike
  }

  interface Window {
    EyeDropper?: new () => EyeDropperInstance
  }
}
