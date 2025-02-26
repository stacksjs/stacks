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

export { version }
