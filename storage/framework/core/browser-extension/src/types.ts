/**
 * Config-driven MV3 browser-extension types.
 *
 * A consuming app declares one `ExtensionConfig` (typically in
 * `config/extension.ts` via `defineExtension`) and the framework derives the
 * manifest, build graph, and packaging from it — no hand-written manifest.json
 * or per-project build script.
 */

export type ExtensionTarget = 'chrome' | 'firefox' | 'safari'

/** A content script mapped into the manifest's `content_scripts`. */
export interface ContentScript {
  /** Source entrypoint, bundled to an IIFE classic script. */
  entry: string
  /** Output filename (defaults to the entry basename with `.js`). */
  out?: string
  /** URL match patterns. */
  matches: string[]
  /** @default 'document_idle' */
  runAt?: 'document_start' | 'document_end' | 'document_idle'
  /** `'MAIN'` runs in the page's own JS context (needed to patch page globals). */
  world?: 'ISOLATED' | 'MAIN'
  allFrames?: boolean
  matchAboutBlank?: boolean
  excludeMatches?: string[]
}

/**
 * A declarativeNetRequest static ruleset. Either point `path` at a pre-built
 * JSON file, or give `source` — a module whose default export is a function (or
 * value) producing the rules array, which the build compiles to
 * `rules/<id>.json`.
 */
export interface RuleResource {
  id: string
  /** Path (relative to outdir) the manifest references. @default `rules/<id>.json` */
  path?: string
  enabled?: boolean
  /** Module whose default export builds the rules array (compiled at build). */
  source?: string
}

/** An extension page: an stx template + an optional companion script. */
export interface ExtensionPage {
  /** stx template, bundled to `<name>.html`. */
  template: string
  /** Companion script (`.ts`) bundled to `<name>.js` and referenced by the page. */
  script?: string
}

/** stx pages bundled to HTML (popup, options, …). A bare string = template only. */
export interface ExtensionPages {
  popup?: string | ExtensionPage
  options?: string | ExtensionPage
  /** Extra `<name, page>` pages bundled to `<name>.html` (+ `<name>.js`). */
  extra?: Record<string, string | ExtensionPage>
}

/** Overrides merged verbatim into the generated manifest, per target. */
export interface ManifestOverrides {
  permissions?: string[]
  hostPermissions?: string[]
  optionalPermissions?: string[]
  minimumChromeVersion?: string
  /** Firefox `browser_specific_settings.gecko.strict_min_version`. */
  firefoxMinVersion?: string
  /**
   * Safari `browser_specific_settings.safari.strict_min_version`.
   * @default '18.4' (first Safari with MAIN-world content scripts + match_about_blank)
   */
  safariMinVersion?: string
  contentSecurityPolicy?: string
  webAccessibleResources?: Array<{ resources: string[], matches: string[] }>
  /** Anything else spread into the manifest as-is. */
  extra?: Record<string, unknown>
}

/** Context passed to build hooks. */
export interface BuildContext {
  config: ExtensionConfig
  target: ExtensionTarget
  /** Absolute output directory. */
  outdir: string
  version: string
  cwd: string
}

export interface ChromeWebStoreConfig {
  /** Publisher identifier from the Chrome Web Store Developer Dashboard. */
  publisherId: string
  /** Existing Chrome Web Store item/extension identifier. */
  itemId: string
  /** Publish immediately after approval or leave staged. @default DEFAULT_PUBLISH */
  publishType?: 'DEFAULT_PUBLISH' | 'STAGED_PUBLISH'
  /** Initial percentage rollout. @default the dashboard's current setting */
  deployPercentage?: number
  /** Request expedited review for an eligible DNR-only update. @default false */
  skipReview?: boolean
}

export interface FirefoxAddonsConfig {
  /** AMO publication channel. @default listed */
  channel?: 'listed' | 'unlisted'
  /** SPDX-style AMO license slug used for a new listing, for example MIT. */
  license?: string
  /** AMO Firefox category slugs used for a new listing. */
  categories?: string[]
  /** Localized listing homepage. */
  homepage?: string
  /** Localized support email. */
  supportEmail?: string
  /** Whether the extension requires payment. @default false */
  requiresPayment?: boolean
  /** Directory for signed XPI and submission artifacts. @default web-ext-artifacts */
  artifactsDir?: string
}

export interface ExtensionConfig {
  /** Display name (`manifest.name`). */
  name: string
  description: string
  /** Firefox add-on id (`browser_specific_settings.gecko.id`). Required to ship on Firefox. */
  geckoId?: string
  /** Chrome Web Store API v2 publication settings. */
  chromeWebStore?: ChromeWebStoreConfig
  /** Mozilla Add-ons (AMO) v5 publication settings. */
  firefoxAddons?: FirefoxAddonsConfig
  /**
   * Base bundle identifier of the Safari container app
   * (`extension:safari:init`); the appex uses `<safariBundleId>.Extension`.
   */
  safariBundleId?: string
  /** Apple Developer team used to sign and publish the Safari container app. */
  safariTeamId?: string
  /**
   * Build-output files to keep out of the Safari appex Resources when syncing
   * (e.g. marketing-site pages that are built into dist but are not part of
   * the extension). Paths relative to the outdir.
   */
  safariExclude?: string[]
  /** Targets to build. @default ['chrome', 'firefox'] */
  targets?: ExtensionTarget[]

  /** Background service worker / event page entry. */
  background?: string
  /** Content scripts. */
  content?: ContentScript[]
  /** stx pages (popup/options/extra). */
  pages?: ExtensionPages
  /** `<size, path>` icons (paths relative to outdir, sourced from `public`). */
  icons?: Record<number, string>
  /** Directory of static assets copied verbatim into the build (icons, stubs, …). */
  public?: string
  /** Extra `<destInOutdir, srcPath>` files copied into the build (e.g. shared CSS). */
  assets?: Record<string, string>
  /** declarativeNetRequest static rulesets. */
  rules?: RuleResource[]

  manifest?: ManifestOverrides

  /** Per-target output dir. @default chrome→`dist`, firefox→`dist-firefox`, safari→`dist-safari` */
  outdir?: Partial<Record<ExtensionTarget, string>> | string

  /** Hooks for app-specific post-processing the generic build can't express. */
  hooks?: {
    /** Runs after everything is built + written (before packaging). */
    postBuild?: (ctx: BuildContext) => void | Promise<void>
  }
}

export interface BuildOptions {
  /** Which target to build. @default 'chrome' */
  target?: ExtensionTarget
  /** Extension version (usually the app's package.json version). */
  version: string
  /** Override the config's outdir. */
  outdir?: string
  /** Minify bundled scripts. @default true */
  minify?: boolean
  /** Project root the config paths are resolved against. @default process.cwd() */
  cwd?: string
}
