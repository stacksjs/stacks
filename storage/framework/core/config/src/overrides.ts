/**
 * **Overrides**
 *
 * This file is what takes prepares the user config to be merged with
 * the default config. For anyone that uses this, ensure you define
 * the alias `~config/` in your tsconfig.json file.
 */

import type { StacksConfig } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { projectPath } from '@stacksjs/path'
import { defaults } from './defaults'
import type { BundledConfig, ConfigSource } from './sources'
import { plainEnv } from './plain-env'
import { bundledConfig, OVERRIDES_READY_KEY, recordConfigSource, USER_CONFIG_FILES } from './sources'
import { validateConfig } from './validators'

// PRODUCTION BINARY MODE: Skip runtime config loading
// When SKIP_CONFIG_LOADING is set, return empty config to avoid parsing external TS files
const skipConfigLoading = process.env.SKIP_CONFIG_LOADING === 'true'

// Opt-out for the boot-time validation step (stacksjs/stacks#1874 F-6).
// Set when running migrations against a partially-configured environment
// or when bringing up a new project before its config is finalized.
// Default is "validate" so typos are caught at boot rather than in
// production via `Cannot read property 'foo' of undefined` later.
const skipConfigValidation = process.env.SKIP_CONFIG_VALIDATION === 'true'

// Anchor `overrides` and the readiness Promise on `globalThis` via well-known
// symbols. Reason: this file gets loaded twice in some module-resolution
// paths (Bun resolves package-relative imports under `@stacksjs/config` along
// a different cache key than the `./overrides` that `config.ts` does
// internally). Without a shared anchor, the proxy in `config.ts` reads from
// instance A while `loadUserConfigs()` mutates instance B, so the Proxy's
// `readMerged()` keeps falling through to defaults forever — the bug that
// made `config.ports.api` return 3008 even after `await overridesReady`.
const OVERRIDES_KEY = Symbol.for('@stacksjs/config:overrides')
const READY_KEY = OVERRIDES_READY_KEY

// `overrides` is exported synchronously, populated from `defaultsForOverrides`
// on creation and *mutated in place* by `loadUserConfigs()` once the user's
// `config/*.ts` files finish loading.
//
// Why not top-level `await import('~/config/*.ts')` like before: each user
// config file pulls in framework helpers (e.g. `config/env.ts` imports
// `@stacksjs/validation`). Those helpers eventually import @stacksjs/storage
// → facade.ts → @stacksjs/config — a static cycle that, combined with TLA
// in this file, leaves @stacksjs/router, @stacksjs/email, and any consumer
// that reads `config.<key>` at module-eval time in TDZ. By making this
// module synchronous, the consumer graph evaluates deterministically and
// `loadUserConfigs()` patches in real values asynchronously in the background.
/*
 * Exported for tests (stacksjs/stacks#2413).
 *
 * The `overrides` object it produces is built once, whenever this module is
 * first evaluated in the process, so a test asserting on it is really asserting
 * on when config happened to load relative to twelve other test files that set
 * `APP_ENV` at module scope. Calling the function directly tests the rule -
 * APP_NAME / APP_ENV win where set - without depending on any of that.
 */
export function defaultsForOverrides(): StacksConfig {
  return {
    ai: {},
    analytics: {},
    // Spread the real `app` defaults rather than hand-writing two of its keys.
    //
    // This object is what every consumer reads BEFORE `loadUserConfigs()`
    // finishes, so any key missing here is `undefined` for a window whose
    // length depends on module load order. `url` was missing, and
    // `config.test.ts` asserting `typeof app.url === 'string'` passed or failed
    // purely on whether the async load happened to win — which made unrelated
    // changes to the resolution graph (a tsconfig `paths` entry, a new
    // package.json dependency) flip `core/config` and `core/env` red with no
    // apparent connection to what changed.
    //
    // `defaults.ts` already computes the complete shape and imports nothing
    // from this file, so there is no cycle. `APP_NAME` / `APP_ENV` still win
    // where set, preserving the previous behaviour for the two keys that had it.
    app: {
      ...defaults.app,
      name: plainEnv('APP_NAME') || defaults.app?.name || 'Stacks',
      env: plainEnv('APP_ENV') || 'production',
    },
    auth: {},
    cache: {},
    cli: {},
    cloud: {},
    cms: {},
    commerce: {},
    dashboard: {},
    database: {},
    dns: {},
    realtime: {},
    email: {},
    errors: {},
    featureFlags: {},
    git: {},
    hashing: {},
    images: {},
    library: {},
    logging: {},
    marketing: {},
    monitoring: {},
    notification: {},
    queue: {},
    payment: {},
    ports: {},
    saas: {},
    searchEngine: {},
    security: {},
    server: {},
    sites: {},
    forms: {},
    services: {},
    sms: {},
    socials: {},
    filesystems: {},
    team: {},
    ui: {},
    // An empty scaffold: every section but `app` is filled from `defaults` at
    // read time by the config proxy. Named as the target type rather than
    // `any`, which also unchecked the `app` block above - the one part of this
    // object that carries real values.
  } as unknown as StacksConfig
}

// Reuse an existing globalThis anchor if a prior module-load already
// initialized it; otherwise create the shared object now.
const globalScope = globalThis as Record<symbol, unknown>
const sharedOverrides = globalScope[OVERRIDES_KEY] as StacksConfig | undefined
export const overrides: StacksConfig = sharedOverrides ?? (() => {
  const created = defaultsForOverrides()
  globalScope[OVERRIDES_KEY] = created
  return created
})()

/**
 * Which of a config's accepted filenames this project actually ships.
 *
 * The first one on disk wins, and the primary name is first, so no project
 * that resolves today resolves differently. Falling through the list rather
 * than importing a missing path keeps the loader's ENOENT handling meaning
 * "this project ships no config of this kind" rather than "the primary name
 * was absent" - which is what made the stx/ui split invisible: `config/stx.ts`
 * is a name stx itself accepts, and this loader read straight past it, leaving
 * `config.ui` undefined while stx reported the file loaded fine
 * (stacksjs/stacks#2446).
 *
 * Both present is ambiguous rather than wrong, so it warns and takes the
 * primary instead of guessing silently.
 */
export function resolveUserConfigName(names: [string, ...string[]], root = projectPath()): string {
  const present = names.filter(candidate => existsSync(resolve(root, 'config', `${candidate}.ts`)))

  if (present.length > 1) {
    console.warn(
      `[config] config/${present.join('.ts and config/')}.ts both exist and configure the same thing. `
      + `Using config/${present[0]}.ts; delete the other so every consumer agrees on one.`,
    )
  }

  return present[0] ?? names[0]
}

/**
 * The project's `config/<name>.ts`, resolved against the project root rather
 * than the working directory. `projectPath()` is where the rest of the
 * framework finds the project (its models, migrations and `.env`), and it
 * climbs out of `storage/framework/...`. Resolving against `process.cwd()`
 * instead meant a process started inside the framework tree, such as a core
 * package's own test run, read the project's `.env` but none of its
 * `config/*.ts`, and fell back to the framework defaults without a word:
 * `config.database.default` was `sqlite` with DB_CONNECTION=postgres
 * (stacksjs/stacks#3356).
 */
export function userConfigUrl(name: string, root = projectPath()): string {
  return pathToFileURL(resolve(root, 'config', `${name}.ts`)).href
}

/**
 * Load the project's `config/*.ts` files into `overrides` in the background.
 * Each module is imported in parallel and merged on top of the synchronous
 * default. Missing files fall back to `{}` silently — projects don't have to
 * ship every config category.
 *
 * Returns a Promise so callers (e.g. `injectGlobalAutoImports`) can await
 * config readiness when they need the real values rather than defaults.
 */
// Shared readiness Promise — the loader runs once per process, even if this
// module is evaluated twice. Without this anchor, two parallel loads each
// kick off their own `loadUserConfigs()` and only one of them mutates the
// `overrides` instance the live config proxy reads from.
const sharedReady = globalScope[READY_KEY] as Promise<StacksConfig> | undefined
export const overridesReady: Promise<StacksConfig> = sharedReady ?? (() => {
  // A compiled app registers its config before this module is evaluated
  // (`registerBundledConfig`): it has no config/ to read (stacksjs/stacks#3368).
  const bundled = bundledConfig()
  const root = bundled ? undefined : projectPath()
  const source: ConfigSource = skipConfigLoading
    ? { from: 'skipped', loaded: [], failed: [] }
    : bundled ? { from: 'bundled', loaded: [], failed: [] } : { from: 'files', root, loaded: [], failed: [] }
  const promise = skipConfigLoading
    ? Promise.resolve(overrides).then((loaded) => {
      recordConfigSource(source)
      return loaded
    })
    : Promise.all(USER_CONFIG_FILES.map(async ([key, ...names]) => {
      const name = bundled ? bundledConfigName(bundled, names) : resolveUserConfigName(names as [string, ...string[]], root)
      if (name === undefined) return
      const modulePath = bundled ? `config/${name}.ts (compiled in)` : userConfigUrl(name, root)
      try {
        const mod = bundled ? await bundled[name]!() as { default?: unknown } : await import(modulePath)
        if (mod?.default !== undefined) {
          (overrides as Record<string, unknown>)[key] = mod.default
          source.loaded.push(name)
        }
      }
      catch (err: unknown) {
        // Distinguish "file simply doesn't exist" from "file exists but is
        // malformed". The first is the common case (projects don't ship
        // every config category) and is fine to silence. The second is a
        // bug that used to silently fall through to defaults — surface it
        // on stderr so users can spot the typo / syntax error in their
        // config file. A compiled-in file exists by definition.
        const code = (err as { code?: string })?.code
        const msg = (err as { message?: string })?.message ?? String(err)
        const isMissing = !bundled && (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND' || /Cannot find module/i.test(msg))
        if (!isMissing) {
          source.failed.push({ name, error: msg })
          // eslint-disable-next-line no-console
          console.warn(`[config] Failed to load ${String(key)} config from ${modulePath}: ${msg}`)
        }
      }
    })).then(() => {
      // Boot-time validation (stacksjs/stacks#1874 F-6). The validators
      // exist in `validators.ts` but were previously never invoked
      // automatically — a typo like `database: { default: 'mysq' }`
      // would slip through and surface as a hard-to-diagnose runtime
      // crash deep inside a query builder. Now: gather all issues,
      // print a structured report, and throw with a clear summary so
      // the bug stops at boot instead of trickling downstream.
      if (!skipConfigValidation) {
        const issues = validateConfig(overrides)
        if (issues.length > 0) {
          // eslint-disable-next-line no-console
          console.error('[config] Configuration issues detected:')
          for (const issue of issues) {
            // eslint-disable-next-line no-console
            console.error(`  • ${issue.path}: ${issue.message}`)
          }
          const summary = issues.map(i => `  • ${i.path}: ${i.message}`).join('\n')
          throw new Error(
            `[config] ${issues.length} configuration issue(s) detected at boot:\n${summary}\n`
            + `Set SKIP_CONFIG_VALIDATION=true to bypass (e.g. when running migrations against partial config).`,
          )
        }
      }
      return overrides
    }).finally(() => {
      // Recorded whether or not validation passed, so a failed boot can say what it read.
      source.loaded.sort()
      recordConfigSource(source)
    })
  globalScope[READY_KEY] = promise
  return promise
})()

/** The first of a config's accepted names the app compiled in, if any. */
function bundledConfigName(bundled: BundledConfig, names: readonly string[]): string | undefined {
  return names.find(candidate => Object.hasOwn(bundled, candidate))
}

export default overrides
