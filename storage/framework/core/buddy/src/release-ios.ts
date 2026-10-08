/**
 * The pieces of `buddy release:ios` that decide what a release is, kept apart
 * from the git and build steps so they can be tested on their own.
 *
 * A release is a tag. `v1.0.0-build.3` ships the third TestFlight build of
 * 1.0.0; `--bump patch|minor|major|x.y.z` moves the version first and starts
 * its builds again at 1. A CI that builds tags (Xcode Cloud's start condition
 * "Tag Changes" with prefix `v`) turns each one into a build. The store's
 * build number is the CI's own counter, so the tag only has to be unique.
 */

const SEMVER = /^\d+\.\d+\.\d+$/

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
  const block = iosBlock(source)
  if (!block || !VERSION_ENTRY.test(source.slice(block.start, block.end)))
    throw new Error('config/mobile.ts declares no iOS `version`')
  const ios = source.slice(block.start, block.end).replace(VERSION_ENTRY, (_, lead, quote) => `${lead}${quote}${version}${quote}`)
  return source.slice(0, block.start) + ios + source.slice(block.end)
}

/** The version a bump leads to, or the one given outright. */
export function bumpedVersion(current: string, bump: string): string {
  if (SEMVER.test(bump))
    return bump
  const [major = 0, minor = 0, patch = 0] = current.split('.').map(Number)
  if (bump === 'major')
    return `${major + 1}.0.0`
  if (bump === 'minor')
    return `${major}.${minor + 1}.0`
  if (bump === 'patch')
    return `${major}.${minor}.${patch + 1}`
  throw new Error(`"${bump}" is not patch, minor, major or a version like 1.2.0`)
}

/** The next build's tag for `version`, after the tags that already exist. */
export function nextBuildTag(version: string, tags: string[]): string {
  const prefix = `v${version}-build.`
  const builds = tags
    .filter(tag => tag.startsWith(prefix))
    .map(tag => Number(tag.slice(prefix.length)))
    .filter(n => Number.isInteger(n) && n > 0)
  return `${prefix}${Math.max(0, ...builds) + 1}`
}
