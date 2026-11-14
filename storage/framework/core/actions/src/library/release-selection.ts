import type { LibraryConfig } from '@stacksjs/types'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { incrementVersion, isCiEnvironment, isValidVersion } from '@stacksjs/bumpx'
import { nextCalendarVersion } from '../calendar-version'
import { configuredLibrary, resolveLibraryPackages } from './packages'

export interface LibraryReleaseVersionChoice { label: string, value: string }
/**
 * Bumpx's version prompt is private and writes immediately after selection.
 * Collect the choice through native CLI first so channel validation precedes
 * every generated file and version mutation. Bump still owns the actual bump.
 */
export async function selectNativeLibraryReleaseVersion(options: {
  cwd: string
  config?: LibraryConfig
  preid?: string
  /** Terminal input boundary; absent in normal Buddy use. */
  choose?: (choices: LibraryReleaseVersionChoice[]) => Promise<string>
  custom?: () => Promise<string>
}): Promise<string | undefined> {
  const config = options.config ?? await configuredLibrary()
  if (config?.releaseable === false) return undefined
  const packages = await resolveLibraryPackages(config, { onUnmatched: 'skip' })
  if (!packages.some(pkg => !pkg.private)) return undefined
  const root = JSON.parse(await readFile(join(options.cwd, 'package.json'), 'utf8')) as { version?: string }
  if (!root.version || !isValidVersion(root.version)) throw new Error('Library release requires a valid project version')
  if (!options.choose && (!process.stdin.isTTY || !process.stdout.isTTY || isCiEnvironment()))
    throw new Error('Library release needs --bump when stdin is not an interactive terminal')
  const choices: LibraryReleaseVersionChoice[] = []
  for (const type of ['patch', 'minor', 'major', 'prepatch', 'preminor', 'premajor', 'prerelease', 'pre', 'build', 'release']) {
    try {
      const value = incrementVersion(root.version, type, options.preid)
      choices.push({ label: `${type} ${value}`, value })
    }
    catch { /* Bumpx omits increments which do not apply to the current version. */ }
  }
  const calendar = nextCalendarVersion(root.version)
  choices.push({ label: `calendar ${calendar}`, value: calendar }, { label: 'custom version', value: 'custom' })
  const { select, text } = await import('@stacksjs/cli')
  const selected = options.choose ? await options.choose(choices) : await select({ message: 'Choose the library release version:', choices }) as string
  const version = selected === 'custom' ? options.custom ? await options.custom() : await text('Enter the new version:') : selected
  if (!version || !isValidVersion(version)) throw new Error('Library release selection requires a valid semantic version')
  return version
}
