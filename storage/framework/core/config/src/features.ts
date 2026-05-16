/**
 * Feature flag helpers.
 *
 * Each framework feature bundle (auth, commerce, cms, marketing, monitoring,
 * realtime, queue, dashboard) is gated by an `enabled` field on its own
 * `config/<feature>.ts` file — Laravel-style — rather than a central
 * `config/features.ts` manifest. If a feature's config file is missing, the
 * feature resolves to its framework default (only `dashboard` defaults on).
 *
 * `feature()` reads the live config proxy, so user overrides land as soon as
 * `overridesReady` resolves; values can also be flipped at runtime via
 * `enableFeature` / `disableFeature` for tests and feature ramps.
 */

import { config } from './config'

export type StacksFeature =
  | 'auth' | 'marketing' | 'cms' | 'commerce'
  | 'dashboard' | 'monitoring' | 'realtime' | 'queue'

const FEATURE_NAMES: readonly StacksFeature[] = [
  'auth', 'marketing', 'cms', 'commerce',
  'dashboard', 'monitoring', 'realtime', 'queue',
] as const

// Only `dashboard` defaults on when its config file is absent — every Stacks
// app wants the admin SPA even at minimum scope. Everything else stays off
// unless the user has scaffolded the config (typically via `buddy <x>:install`).
const FEATURE_DEFAULTS: Record<string, boolean> = {
  dashboard: true,
}

const overrides = new Map<string, boolean>()

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
export function feature(name: string): boolean {
  if (overrides.has(name)) return overrides.get(name)!

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
export function enableFeature(name: string): void {
  overrides.set(name, true)
}

/**
 * Force-disable a feature in the running process.
 */
export function disableFeature(name: string): void {
  overrides.set(name, false)
}

/**
 * Drop a runtime override and fall back to the config-driven value.
 */
export function resetFeature(name: string): void {
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
