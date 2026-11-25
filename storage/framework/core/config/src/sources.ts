/**
 * **Where config comes from**
 *
 * The project's `config/*.ts` reach the config proxy one of two ways. A
 * process started from the project imports them from `config/` on disk. A
 * compiled app has no `config/` beside it, and the loader's `import()` of a
 * computed path is one the bundler cannot follow, so the app fell back to the
 * framework defaults with no word said (stacksjs/stacks#3368). The build now
 * names each file in a static `import()` and registers those loaders here
 * before config loads.
 *
 * This module imports nothing, so registering costs nothing and cannot pull
 * the config graph in early. The loader records what it loaded here as well,
 * so whatever boots the app can say which config it booted with.
 */

/**
 * `[configKey, filename, ...alternativeFilenames]` for every file the loader
 * reads from `config/`.
 *
 * The alternatives exist because stx accepts either name for its own config:
 * `loadStxConfig` resolves `{ name: 'stx', alias: 'ui' }`, so an app can write
 * `config/stx.ts` and stx reads it happily - while the loader looked only for
 * `config/ui.ts` and left `config.ui` undefined. `resolveViewPatterns` treats
 * undefined exactly like `true`, so such an app kept mounting the framework's
 * demo views through a green build and a green deploy (stacksjs/stacks#2446).
 *
 * The first name that exists wins, and the primary stays first, so no app that
 * resolves today resolves differently.
 */
export const USER_CONFIG_FILES: ReadonlyArray<readonly [string, string, ...string[]]> = [
  ['ai', 'ai'],
  ['analytics', 'analytics'],
  ['app', 'app'],
  ['auth', 'auth'],
  ['cache', 'cache'],
  ['cli', 'cli'],
  ['cloud', 'cloud'],
  ['cms', 'cms'],
  ['commerce', 'commerce'],
  // `config/cors.ts` is the file app/Middleware/Cors.ts documents as the
  // place to configure CORS, but it was missing from this list, so it was
  // read by nothing. The middleware fell back to its defaults —
  // `origin: '*'`, `credentials: false` — no matter what the app wrote.
  // A browser refuses a credentialed cross-origin request answered with a
  // wildcard origin, so an app whose frontend and API sit on different
  // origins could not log in at all, while its config file sat there
  // looking authoritative. `StacksConfig` already declared `cors?`.
  ['cors', 'cors'],
  ['dashboard', 'dashboard'],
  ['database', 'database'],
  ['dns', 'dns'],
  ['docs', 'docs'],
  ['email', 'email'],
  ['errors', 'errors'],
  ['featureFlags', 'feature-flags'],
  ['git', 'git'],
  ['hashing', 'hashing'],
  ['images', 'images'],
  ['library', 'library'],
  ['logging', 'logging'],
  ['marketing', 'marketing'],
  ['monitoring', 'monitoring'],
  ['notification', 'notification'],
  ['payment', 'payment'],
  ['ports', 'ports'],
  ['queue', 'queue'],
  ['realtime', 'realtime'],
  ['saas', 'saas'],
  ['searchEngine', 'search-engine'],
  ['security', 'security'],
  ['sites', 'sites'],
  ['forms', 'forms'],
  ['server', 'server'],
  ['services', 'services'],
  // `config/sms.ts` ships in every app and declares `provider`, the drivers
  // and their credentials, and `StacksOptions` has always declared
  // `sms: SmsConfig` — but the entry was missing here, so the file was read by
  // nothing and `config.sms` was the framework default no matter what the app
  // wrote. Verified by setting `provider: 'vonage'` in `config/sms.ts` and
  // watching `config.sms.provider` still resolve to `'twilio'`. Same shape as
  // the `cors` entry above (stacksjs/stacks#2876).
  ['sms', 'sms'],
  ['socials', 'socials'],
  ['filesystems', 'filesystems'],
  ['team', 'team'],
  ['ui', 'ui', 'stx'],
]

/** Every file name the loader reads from `config/`, without `.ts`. */
export function userConfigFileNames(): string[] {
  return USER_CONFIG_FILES.flatMap(([, ...names]) => names)
}

/** A config file the build compiled in: its `config/<name>.ts`, by name, as a static `import()`. */
export type BundledConfig = Record<string, () => unknown>

/** Which config the process booted with, recorded by the loader once it has run. */
export interface ConfigSource {
  /** `bundled`: compiled into the app. `files`: read from `config/` under `root`. `skipped`: `SKIP_CONFIG_LOADING`. */
  from: 'bundled' | 'files' | 'skipped'
  /** The project root the files were looked for under (`files` only). */
  root?: string
  /** The `config/<name>.ts` files that loaded, by name. Every other section is the framework default. */
  loaded: string[]
  /** Files that exist but threw while loading; their sections are the framework defaults too. */
  failed: Array<{ name: string, error: string }>
}

const BUNDLED_KEY = Symbol.for('@stacksjs/config:bundled')
const SOURCE_KEY = Symbol.for('@stacksjs/config:source')
/** The loader's readiness Promise, anchored by `overrides.ts`; present once config has started loading. */
export const OVERRIDES_READY_KEY: symbol = Symbol.for('@stacksjs/config:overridesReady')

const scope = globalThis as Record<symbol, unknown>

/**
 * Hand the loader the app's compiled-in config, to use instead of `config/`
 * on disk. Must run before anything imports `@stacksjs/config`: the loader
 * reads `config/` once, when it is first evaluated, and a registration after
 * that would be ignored, so it throws instead.
 */
export function registerBundledConfig(config: BundledConfig): void {
  if (scope[OVERRIDES_READY_KEY]) {
    throw new Error('Config has already loaded from config/ on disk, so the bundled config would be ignored. Register it before anything imports @stacksjs/config.')
  }
  scope[BUNDLED_KEY] = config
}

/** The registered compiled-in config, if any. */
export function bundledConfig(): BundledConfig | undefined {
  return scope[BUNDLED_KEY] as BundledConfig | undefined
}

/** Which config this process booted with; undefined until the loader has finished. */
export function configSource(): ConfigSource | undefined {
  return scope[SOURCE_KEY] as ConfigSource | undefined
}

/**
 * Which config this process booted with, once the loader has finished:
 * waits for it when config has started loading, and is undefined when nothing
 * has imported config at all. A failed load still says what it read.
 */
export async function settledConfigSource(): Promise<ConfigSource | undefined> {
  const ready = scope[OVERRIDES_READY_KEY] as Promise<unknown> | undefined
  if (ready) await ready.catch(() => {})
  return configSource()
}

/** For the loader: record what it loaded. */
export function recordConfigSource(source: ConfigSource): void {
  scope[SOURCE_KEY] = source
}

/** One line saying which config the process booted with, for a log. */
export function describeConfigSource(source: ConfigSource): string {
  const where = source.from === 'bundled' ? 'compiled into the app' : `from ${source.root ?? '.'}/config`
  if (source.from === 'skipped') return 'config: not loaded (SKIP_CONFIG_LOADING), framework defaults throughout'
  const failed = source.failed.length ? `; failed: ${source.failed.map(file => `${file.name}.ts (${file.error})`).join(', ')}` : ''
  if (!source.loaded.length) return `config: no config/*.ts ${source.from === 'bundled' ? 'compiled into the app' : `under ${source.root ?? '.'}`}, framework defaults throughout${failed}`
  return `config: ${source.loaded.map(name => `${name}.ts`).join(', ')} ${where}; framework defaults for the rest${failed}`
}
