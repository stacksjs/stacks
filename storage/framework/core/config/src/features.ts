/**
 * Feature flag helpers.
 *
 * Each framework feature (commerce, cms, forms, marketing, monitoring,
 * realtime, queue, dashboard, plus the auth and email gates) is switched by an
 * `enabled` field on its own `config/<feature>.ts` file — Laravel-style — rather than a central
 * `config/features.ts` manifest. If a feature's config file is missing, the
 * feature resolves to its framework default (only `dashboard` defaults on).
 *
 * `feature()` reads the live config proxy, so user overrides land as soon as
 * `overridesReady` resolves; values can also be flipped at runtime via
 * `enableFeature` / `disableFeature` for tests and feature ramps.
 */

import { FEATURE_NAMES as INSTALLABLE_FEATURES, type FeatureName } from '@stacksjs/features/names'
import { config } from './runtime'

/**
 * Every name `feature()` answers for: the installable bundles, plus two gates
 * that are config sections rather than bundles.
 *
 * Derived rather than restated. The bundles were spelled out here as well as in
 * `@stacksjs/features`, and nothing related the two lists, so a feature added
 * to one and not the other shipped silently - config-only meant no install
 * command and no migration gating, features-only meant `canonicalFeatures()`
 * no longer forced it on and generated artifacts stopped being a function of
 * the source alone (stacksjs/stacks#2867, #2408).
 *
 * Imported from `@stacksjs/features/names`, not the package root: the root also
 * carries the file and table manifests and reaches `node:fs` and
 * `@stacksjs/path` for them, which costs about a millisecond on a path every
 * process walks before anything else. The names module imports nothing.
 *
 * The two gates have no install command, because there is nothing to install:
 *
 * - `auth` (`config/auth.ts`) decides whether `@stacksjs/orm` loads the
 *   framework's account-family models - `Team`, `TeamMember`, `Referral`,
 *   `SocialAccount`, `Subscriber`, `Subscription`, `Site`, `MagicLinkToken`,
 *   `GdprRequest` and the rest of its manifest's `'auth'` rows. It does NOT
 *   mount the auth routes. `config/auth.ts` ships enabled in every app, so
 *   gating `/login`, `/register` and `/auth/tokens` on it would mount them
 *   into every app running with `dashboard` off; route selection is explicit,
 *   through `STACKS_DEFAULT_ROUTES` (see `router/src/route-loader.ts`).
 * - `email` (`config/email.ts`) gates the `email` route bundle - the provider
 *   webhooks - when an app has not named its bundles. It was a name only the
 *   router knew, so canonical mode did not force it on.
 */
export type StacksFeature = FeatureName | 'auth' | 'email'

/**
 * Flags an app defines for itself - a ramp switched with `enableFeature`, or
 * a `config/<name>.ts` with an `enabled` field. Declare them here so
 * `feature()` accepts them; anything else is a compile error, which is what
 * keeps `feature('commrce')` from being a silent `false`:
 *
 * ```ts
 * declare module '@stacksjs/config' {
 *   interface AppFeatureFlags {
 *     'new-checkout': true
 *   }
 * }
 * ```
 */
// eslint-disable-next-line ts/no-empty-object-type
export interface AppFeatureFlags {}

/** A name `feature()` accepts: the framework's, or one the app declared. */
export type FeatureFlag = StacksFeature | Extract<keyof AppFeatureFlags, string>

const FEATURE_NAMES: readonly StacksFeature[] = [...INSTALLABLE_FEATURES, 'auth', 'email'] as const

// Only `dashboard` defaults on when its config file is absent — every Stacks
// app wants the admin SPA even at minimum scope. Everything else stays off
// unless the user has scaffolded the config (typically via `buddy <x>:install`).
const FEATURE_DEFAULTS: Record<string, boolean> = {
  dashboard: true,
}

const overrides = new Map<FeatureFlag, boolean>()

function configFor(name: string): Record<string, unknown> | undefined {
  const raw = (config as unknown as Record<string, unknown>)[name]
  return raw && typeof raw === 'object' ? raw as Record<string, unknown> : undefined
}

/**
 * Truthy when the named feature is enabled in the current environment.
 *
 * Resolution order (first match wins):
 *   1. Runtime override via `enableFeature` / `disableFeature`
 *   2. `config.<name>.enabled` — boolean or omitted
 *      - Optional `config.<name>.env: string[]` narrows the flag to specific
 *        deploy targets (compared against `config.app.env`)
 *   3. Per-feature framework default (only `dashboard` defaults true)
 *
 * @example
 * ```ts
 * if (feature('commerce')) {
 *   await loadCommerceRoutes()
 * }
 * ```
 */
/**
 * Canonical mode: every framework feature reads as enabled.
 *
 * Generated artifacts - the auto-import barrels, the server declarations - are
 * a function of which features are on, because `feature()` decides which models
 * and jobs load at all. That made "is this file current?" unanswerable: config
 * reads env, so a developer with `.env.keys` generates one set and CI without
 * it generates another, and the diff looks like staleness when nothing is
 * stale (stacksjs/stacks#2408).
 *
 * Generating with every feature on makes the output a function of the SOURCE
 * alone, which is what a regenerate-and-diff freshness check needs.
 *
 * An env var rather than an `enableFeature()` call at the entry point, because
 * generation spans processes: `buddy generate` spawns, and orm's deferred
 * loader imports config on its own. An env var crosses those boundaries; a
 * mutation of this module's map does not.
 *
 * Off unless explicitly set, so nothing about a running app changes.
 */
function canonicalFeatures(): boolean {
  return process.env.STACKS_CANONICAL_FEATURES === '1'
}

export function feature(name: FeatureFlag): boolean {
  // An explicit runtime override still wins - tests that disable a feature
  // mean it, canonical mode or not.
  if (overrides.has(name)) return overrides.get(name)!

  if (canonicalFeatures() && (FEATURE_NAMES as readonly string[]).includes(name))
    return true

  const cfg = configFor(name)
  if (cfg) {
    const enabledField = cfg.enabled
    // Config file exists. An explicit `enabled: false` short-circuits.
    if (enabledField === false) return false

    // Optional env gate: `env: ['production']` means only enabled in prod.
    if (Array.isArray(cfg.env) && cfg.env.length > 0) {
      const currentEnv = ((config as unknown as { app?: { env?: string } }).app?.env ?? '').toString()
      if (!(cfg.env as string[]).includes(currentEnv)) return false
    }

    // `enabled: true` (or any truthy non-false) → on.
    // No `enabled` field but config object exists → presence implies on.
    if (enabledField !== undefined) return !!enabledField
    return true
  }

  // Config file missing → fall back to the per-feature framework default.
  return FEATURE_DEFAULTS[name] ?? false
}

/**
 * Force-enable a feature in the running process. Intended for tests and
 * staged rollouts; production code should prefer config-file overrides.
 */
export function enableFeature(name: FeatureFlag): void {
  overrides.set(name, true)
}

/**
 * Force-disable a feature in the running process.
 */
export function disableFeature(name: FeatureFlag): void {
  overrides.set(name, false)
}

/**
 * Drop a runtime override and fall back to the config-driven value.
 */
export function resetFeature(name: FeatureFlag): void {
  overrides.delete(name)
}

/**
 * Snapshot of the live flag set — useful for `/__features` debug endpoints
 * and CLI commands that print the active configuration. Iterates the known
 * framework features plus any runtime overrides for ad-hoc flags.
 */
export function listFeatures(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const name of FEATURE_NAMES) out[name] = feature(name)
  for (const name of overrides.keys()) out[name] = feature(name)
  return out
}
