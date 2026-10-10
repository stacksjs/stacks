/**
 * The pieces of `buddy release:ios` that decide what a release is, kept apart
 * from the git and build steps so they can be tested on their own.
 *
 * A release is a tag. `v1.0.0-build.3` ships the third TestFlight build of
 * 1.0.0; `--bump build` (also the default) keeps the marketing version.
 * `--bump patch|minor|major|x.y.z` moves that version deliberately.
 * A CI that builds tags (Xcode Cloud's start condition
 * "Tag Changes" with prefix `v`) turns each one into a build. The store's
 * build number is the CI's own counter; allocation considers existing tags
 * and every Xcode Cloud run, including failed or in-flight runs.
 */

import { incrementVersion, nextBuildNumber, SemVer } from '@stacksjs/bumpx'

function marketingVersion(version: string): string {
  const parsed = new SemVer(version)
  if (parsed.prerelease.length || parsed.build.length || parsed.toString() !== version)
    throw new Error('An iOS marketing version must be a stable version such as 1.0.0')
  return parsed.toString()
}

/** The `ios: { ... }` part of config/mobile.ts, as offsets into the source. */
function iosBlock(source: string): { start: number, end: number } | null {
  const start = source.search(/\bios\s*:\s*\{/)
  if (start === -1)
    return null
  const after = source.slice(start + 1).search(/\n\s*(?:android|desktop|watch|web)\s*:\s*\{/)
  return { start, end: after === -1 ? source.length : start + 1 + after }
}

const VERSION_ENTRY = /(\bversion\s*:\s*(?:[^,\n]*?\?\?\s*)?)(['"])(\d+\.\d+\.\d+)\2/

/** The iOS app version config/mobile.ts declares (the default, when it reads an env var first). */
export function iosVersionIn(source: string): string | null {
  const block = iosBlock(source)
  if (!block)
    return null
  return VERSION_ENTRY.exec(source.slice(block.start, block.end))?.[3] ?? null
}

/** config/mobile.ts with the iOS app version replaced, everything else as written. */
export function withIosVersion(source: string, version: string): string {
  marketingVersion(version)
  const block = iosBlock(source)
  if (!block || !VERSION_ENTRY.test(source.slice(block.start, block.end)))
    throw new Error('config/mobile.ts declares no iOS `version`')
  const ios = source.slice(block.start, block.end).replace(VERSION_ENTRY, (_, lead, quote) => `${lead}${quote}${version}${quote}`)
  return source.slice(0, block.start) + ios + source.slice(block.end)
}

/** The version a bump leads to, or the one given outright. */
export function bumpedVersion(current: string, bump: string): string {
  marketingVersion(current)
  if (bump === 'build') return current
  if (['patch', 'minor', 'major'].includes(bump))
    return marketingVersion(incrementVersion(current, bump))
  return marketingVersion(bump)
}

/** The next build's tag for `version`, after the tags that already exist. */
export function nextBuildTag(version: string, tags: string[], latestRun = 0): string {
  marketingVersion(version)
  const prefix = `v${version}-build.`
  const builds = tags
    .filter(tag => tag.startsWith(prefix))
    .map(tag => tag.slice(prefix.length))
    .filter(number => /^[1-9]\d*$/.test(number))
    .map(Number)
    .filter(Number.isSafeInteger)
  return `${prefix}${nextBuildNumber(latestRun, builds)}`
}
