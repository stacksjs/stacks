/**
 * Feature flag helpers.
 *
 * The framework has a long history of scattering opt-in flags across
 * `config/queue.ts`, `config/database.ts.queryLogging.enabled`,
 * `config/cache.ts.enabled`, etc. — each one with a slightly different
 * shape (`enabled: bool` vs `default: 'driver'` vs presence-of-key).
 *
 * This module gives a single canonical answer to "is feature X turned on
 * for this app/env right now?" The flag values are read from the live
 * config proxy so user `~/config/features.ts` overrides land as soon as
 * `overridesReady` resolves; values can also be flipped at runtime via
 * `enableFeature` / `disableFeature` for tests and feature ramps.
 */

import { config } from './config'

type FlagValue = boolean | { enabled?: boolean, env?: string[] }

interface FeaturesConfigShape {
  // Index signature so users can declare any flag they want without
  // upstream type changes. Stacks code that uses a specific flag should
  // treat the result as boolean.
  [name: string]: FlagValue | undefined
}

const overrides = new Map<string, boolean>()

function rawConfig(): FeaturesConfigShape {
  return ((config as unknown as Record<string, unknown>).features ?? {}) as FeaturesConfigShape
}

/**
 * Truthy when the named feature is enabled in the current environment.
 *
 * Resolution order (first match wins):
 *   1. Runtime override via `enableFeature` / `disableFeature`
 *   2. Object form `{ enabled: true, env: ['production'] }` — env list
 *      gates the flag to specific deploy targets (matched against
 *      `config.app.env`)
 *   3. Boolean form `true` / `false`
 *   4. Missing → `false`
 *
 * @example
 * ```ts
 * if (feature('experimental-streaming')) {
 *   return response.stream(producer)
 * }
 * ```
 */
export function feature(name: string): boolean {
  if (overrides.has(name)) return overrides.get(name)!
  const raw = rawConfig()[name]
  if (raw === undefined || raw === null) return false
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'object') {
    if (raw.enabled === false) return false
    if (Array.isArray(raw.env) && raw.env.length > 0) {
      const currentEnv = ((config as unknown as { app?: { env?: string } }).app?.env ?? '').toString()
      if (!raw.env.includes(currentEnv)) return false
    }
    // raw.enabled is `true | undefined` here; treat undefined as enabled
    return raw.enabled !== undefined ? raw.enabled : true
  }
  return false
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
 * Snapshot of the live flag set — useful for `/__features` debug
 * endpoints and CLI commands that print the active configuration.
 */
export function listFeatures(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const name of Object.keys(rawConfig())) {
    out[name] = feature(name)
  }
  for (const name of overrides.keys()) {
    out[name] = feature(name)
  }
  return out
}
