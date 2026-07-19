import { version } from '../package.json'

export const semver: typeof Bun.semver = Bun.semver

export function isVersionGreaterThan(version: string, compareVersion: string): boolean {
  return Bun.semver.order(version, compareVersion) === 1
}

export function isVersionLessThan(version: string, compareVersion: string): boolean {
  return Bun.semver.order(version, compareVersion) === -1
}

export function isVersionEqual(version: string, compareVersion: string): boolean {
  return Bun.semver.order(version, compareVersion) === 0
}

export function isVersionGreaterThanOrEqual(version: string, compareVersion: string): boolean {
  return Bun.semver.order(version, compareVersion) >= 0
}

export function isVersionLessThanOrEqual(version: string, compareVersion: string): boolean {
  return Bun.semver.order(version, compareVersion) <= 0
}

/**
 * The minimum Bun version required to run Stacks. Keep in sync with the
 * `system.bun` range in the root `package.json` and the prerequisites in
 * the README and docs.
 */
export const minimumBunVersion = '1.3.0'

/**
 * Returns `true` when the given Bun version satisfies `minimumBunVersion`.
 * Comparison is numeric per segment via Bun's semver ordering, so `1.10.2`
 * correctly sorts above `1.3.0`.
 */
export function isSupportedBunVersion(version: string): boolean {
  return isVersionGreaterThanOrEqual(version, minimumBunVersion)
}

export { version }
