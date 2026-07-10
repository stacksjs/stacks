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
  /** Extra `<destInOutdir, srcPath>` files copied into the build (e.g. shared CSS). */
  assets?: Record<string, string>
  /** declarativeNetRequest static rulesets. */
  rules?: RuleResource[]

  manifest?: ManifestOverrides

  /** Per-target output dir. @default chrome→`dist`, firefox→`dist-firefox` */
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
