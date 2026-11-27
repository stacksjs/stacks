import type { LibraryConfig } from '@stacksjs/types/library'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chooseReleaseVersion } from '../release-version'
import { configuredLibrary, resolveLibraryPackages } from './packages'

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
  choose?: Parameters<typeof chooseReleaseVersion>[1]['choose']
  custom?: () => Promise<string>
}): Promise<string | undefined> {
  const config = options.config ?? await configuredLibrary()
  if (config?.releaseable === false) return undefined
  const packages = await resolveLibraryPackages(config, { onUnmatched: 'skip' })
  if (!packages.some(pkg => !pkg.private)) return undefined
  const root = JSON.parse(await readFile(join(options.cwd, 'package.json'), 'utf8')) as { version?: string }
  return chooseReleaseVersion(root.version, { subject: 'library', preid: options.preid, choose: options.choose, custom: options.custom })
}
