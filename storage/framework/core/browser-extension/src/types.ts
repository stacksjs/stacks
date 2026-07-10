/**
 * Config-driven MV3 browser-extension types.
 *
 * A consuming app declares one `ExtensionConfig` (typically in
 * `config/extension.ts` via `defineExtension`) and the framework derives the
 * manifest, build graph, and packaging from it — no hand-written manifest.json
 * or per-project build script.
 */

export type ExtensionTarget = 'chrome' | 'firefox'

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

/** A declarativeNetRequest static ruleset. */
export interface RuleResource {
  id: string
  /** Path (relative to outdir) to the compiled ruleset JSON. @default `rules/<id>.json` */
  path?: string
  enabled?: boolean
}

/** An stx page bundled to HTML (popup, options, …). */
export interface ExtensionPages {
  /** Toolbar popup (`action.default_popup`). */
  popup?: string
  /** Options page (`options_page`). */
  options?: string
  /** Extra `<name, entry>` stx pages bundled to `<name>.html`. */
  extra?: Record<string, string>
}

/** Overrides merged verbatim into the generated manifest, per target. */
export interface ManifestOverrides {
  permissions?: string[]
  hostPermissions?: string[]
  optionalPermissions?: string[]
  minimumChromeVersion?: string
  /** Firefox `browser_specific_settings.gecko.strict_min_version`. */
  firefoxMinVersion?: string
  contentSecurityPolicy?: string
  webAccessibleResources?: Array<{ resources: string[], matches: string[] }>
  /** Anything else spread into the manifest as-is. */
  extra?: Record<string, unknown>
}

export interface ExtensionConfig {
  /** Display name (`manifest.name`). */
  name: string
  description: string
  /** Firefox add-on id (`browser_specific_settings.gecko.id`). Required to ship on Firefox. */
  geckoId?: string
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
  /** declarativeNetRequest static rulesets. */
  rules?: RuleResource[]

  manifest?: ManifestOverrides

  /** Per-target output dir. @default chrome→`dist`, firefox→`dist-firefox` */
  outdir?: Partial<Record<ExtensionTarget, string>> | string
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
