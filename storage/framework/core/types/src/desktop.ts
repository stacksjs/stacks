import type { MobilePrivacyManifest } from './mobile'

/**
 * `config/desktop.ts`: the desktop apps a Stacks project builds, the way
 * `config/mobile.ts` declares its phone apps. Today the one target is a
 * native macOS app: the project's stx screens drawn by Craft's AppKit host
 * (no web view), signed and packaged by `buddy build:desktop` and
 * `buddy desktop:apple:package`.
 *
 * ```ts
 * export default {
 *   macos: {
 *     appName: 'Library',
 *     bundleId: 'com.example.library',
 *     teamId: 'ABCDE12345',
 *     url: env.DESKTOP_API_URL ?? 'http://127.0.0.1:3000',
 *     nativeScreens: ['Main', 'Settings'],
 *     shareStorage: { auth_token: 'auth.token' },
 *   },
 * } satisfies DesktopConfig
 * ```
 */
export interface DesktopConfig {
  macos?: MacosDesktopConfig
}

export interface MacosWindowConfig {
  /** Points; the main window's first size. */
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  /** `transparent` hides the title and lets content run under the title bar. */
  titlebarStyle?: 'standard' | 'transparent'
}

export interface MacosDesktopConfig {
  /** The name people see: the bundle, the menu bar, the window title. */
  appName: string
  /** Reverse-DNS bundle identifier, e.g. `com.example.library`. */
  bundleId: string
  /** The Apple Developer team (10 characters); not a secret. Needed to sign for the Mac App Store. */
  teamId?: string
  /** Marketing version. Defaults to the project's package.json version. */
  version?: string
  /** Build number. Defaults to the version's digits; the App Store wants it to grow with each upload. */
  buildNumber?: string
  /** `LSMinimumSystemVersion`. Default `13.0`. */
  minimumSystemVersion?: string
  /** `LSApplicationCategoryType`. Default `public.app-category.productivity`. */
  category?: string
  /**
   * The server the app talks to: where relative `fetch` calls go
   * (`craft.app.url`). A hosted-API app has no local agent, so the host starts
   * with no session handshake.
   */
  url: string
  /**
   * The native screens, by name: each `<name>.stx` in `nativeScreensDir`, or
   * a map of name to `.stx` path from the project root. The first (or
   * `initialScreen`) opens in the main window; the others are windows the
   * app opens by name (Settings).
   */
  nativeScreens: string[] | Record<string, string>
  /** Where named screens live. Default `resources/native`. */
  nativeScreensDir?: string
  /** The screen the main window opens. Default `Main`, else the first. */
  initialScreen?: string
  /** An app script run once beside the screens (as `ios.nativeApp`). */
  nativeApp?: string
  /**
   * Web-storage keys kept as Keychain items: `{ auth_token: 'auth.token' }`.
   * The sign-in token (`auth.token`) is the app's `craft.session`.
   */
  shareStorage?: Record<string, string>
  window?: MacosWindowConfig
  /** `CFBundleURLSchemes`, for links that open the app. */
  urlSchemes?: string[]
  /** A 1024 pixel square PNG (or an `.icns`); the build makes the icon set. */
  icon?: string
  /**
   * Run in the App Sandbox. Default `true`, which the Mac App Store requires;
   * the app then gets `network.client` and its own Keychain access group.
   */
  sandbox?: boolean
  /**
   * Entitlements added to (and overriding) the defaults, by their full key:
   * `{ 'com.apple.security.files.user-selected.read-write': true }`.
   */
  entitlements?: Record<string, boolean | string | string[]>
  /** `NS*UsageDescription` strings: the sentences people read in a permission prompt. */
  usageDescriptions?: Record<string, string>
  /** Extra `Info.plist` keys. The keys the build owns (identity, version, executable) are ignored. */
  infoPlist?: Record<string, unknown>
  /** Written as `PrivacyInfo.xcprivacy`. */
  privacy?: MobilePrivacyManifest
  /** Where the built `.app` goes. Default `storage/framework/desktop/macos`. */
  output?: string
}
