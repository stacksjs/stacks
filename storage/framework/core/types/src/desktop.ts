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
 *
 * A local-first app (a browser, an inbox) runs its API inside the app instead
 * of talking to a hosted one: `agent: true` starts the project's routes on
 * 127.0.0.1 and points the host at them (`buddy new <name> --desktop`
 * scaffolds that).
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
   * with no session handshake. Required unless `agent` is on, which points
   * the host at the agent instead.
   */
  url?: string
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
  /**
   * Run the app's own API inside the app: a loopback server (127.0.0.1) that
   * serves the project's routes and actions in process, with the AppKit host
   * as its window. `url` is then ignored: the host is pointed at the agent's
   * port, which is remembered between launches. Only the host the agent
   * started can call it - it hands that host an HttpOnly, SameSite=Strict
   * session cookie at `/native/session`, minted fresh on every launch, and
   * refuses any request without it or with a Host header that is not the
   * agent's own (so a DNS-rebinding page cannot pose as it). Default `false`.
   */
  agent?: boolean | MacosAgentConfig
  /**
   * Build the AppKit host with WebKit linked, so screens can embed a
   * `<WebView>` (a browser's tabs). Default `false`: the host has no web
   * view at all, which keeps it small and keeps the Mac App Store review of
   * a plain native app simple.
   */
  webkit?: boolean
  /**
   * Offer the app as a web browser: `CFBundleURLTypes` for http and https and
   * `CFBundleDocumentTypes` for HTML, XHTML, web archives and PDF, so it is
   * listed under System Settings > Default web browser. Default `false`.
   */
  defaultBrowser?: boolean
  /**
   * What the app may reach. Each adds its entitlement and, where macOS asks
   * the user first, the usage string they read in the prompt (a string sets
   * the sentence; `true` uses a plain default).
   */
  permissions?: MacosPermissions
  /** Items above the app's windows in its Dock menu (right-click the Dock icon). */
  dockMenu?: MacosDockMenuItem[]
}

export interface MacosAgentConfig {
  /** The port to try first; the last port used, then any free port, after it. Default: the remembered port. */
  port?: number
  /**
   * The module that adds the agent's own routes, relative to the project root.
   * It is bundled into the built app, so its routes work wherever the app is
   * installed. Default `app/Desktop/Agent.ts`, when it exists.
   */
  entry?: string
  /**
   * Serve the project's route registry (`app/Routes.ts`, `routes/*.ts`) from
   * the agent as well as `entry`. Default `true`. `buddy dev:desktop` loads it
   * from the project, as `buddy dev:api` does; a built app carries the route
   * files compiled into its executable, so what a route imports goes with it.
   * Routes added by `entry` are not prefixed: write their full path.
   */
  appRoutes?: boolean
  /** A directory of static files the agent serves (a web UI the host can open). Relative to the project root. */
  staticDir?: string
}

export interface MacosPermissions {
  /** Outbound connections. Default `true` (the sandbox otherwise has none). */
  network?: boolean
  /** The camera: `com.apple.security.device.camera` and `NSCameraUsageDescription`. */
  camera?: boolean | string
  /** The microphone: `com.apple.security.device.audio-input` and `NSMicrophoneUsageDescription`. */
  microphone?: boolean | string
  /** Location: `com.apple.security.personal-information.location` and the location usage strings. */
  location?: boolean | string
  /** The Downloads folder, read-write (`true`) or read-only. */
  downloads?: boolean | 'read-only'
  /** Printing (`com.apple.security.print`). */
  printing?: boolean
}

export interface MacosDockMenuItem {
  /** What the menu shows. */
  title: string
  /** The name the app's screens receive in the `dockMenu` event when it is chosen. */
  action: string
}
