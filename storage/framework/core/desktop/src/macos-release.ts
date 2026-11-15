import type { DesktopTargetName } from '@stacksjs/types'
import type { ResolvedMacosDesktop } from './macos-app'
import { join } from 'node:path'
import { releaseArtifactNames } from './webview-app'

/**
 * Where `buddy release:desktop` puts a native macOS app's release, and what
 * it tells Pantry about it. Pure functions of the config and the build, so
 * the layout can be asserted without signing or notarizing anything.
 */

export interface MacosReleasePlan {
  /** `darwin-<arch>`: the feed's platform and architecture. */
  target: DesktopTargetName
  /** `<output>/release/darwin-<arch>`: the staged artifacts and `latest.json`. */
  staged: string
  /** The zipped `.app` an installed app updates from. */
  update: string
  /** The disk image a person downloads. */
  dmg: string
}

/**
 * The files a release of a `macos` app is made of, named and placed as a web
 * view app's Mac release is (`<App>-<version>-<arch>.zip` and `.dmg`), so the
 * feed, the artifact route and a download page treat both kinds alike.
 * `architecture` is a Node id (`arm64`, `x64`): the machine the host was built on.
 */
export function macosReleasePlan(options: { output: string, appName: string, version: string, architecture: string }): MacosReleasePlan {
  if (!['arm64', 'x64'].includes(options.architecture)) throw new Error(`A macOS app is built for arm64 or x64, not "${options.architecture}"`)
  const target = `darwin-${options.architecture}` as DesktopTargetName
  const names = releaseArtifactNames({ appName: options.appName, version: options.version }, target)
  const staged = join(options.output, 'release', target)
  return { target, staged, update: join(staged, names.update), dmg: join(staged, names.downloads[0]!) }
}

/**
 * What Pantry's native app pipeline reads from `.pantry/native/artifact.json`
 * (`NativeArtifact` in `ts-pantry/native`): the file it notarizes and
 * releases, the app inside it, and the identity it checks the built
 * `Info.plist` against.
 */
export interface MacosPantryArtifact {
  /** The disk image: what Pantry signs, notarizes, staples and attaches to the release. */
  path: string
  /** The Developer ID `.app`: what Pantry launches, assesses and publishes to its registry. */
  appPath: string
  /** The executable's name in `Contents/MacOS`. */
  name: string
  bundleId: string
  version: string
  buildNumber: string
  target: 'macos'
  minimumSystemVersion: string
}

export function macosPantryArtifact(config: Pick<ResolvedMacosDesktop, 'appName' | 'executable' | 'bundleId' | 'version' | 'buildNumber' | 'minimumSystemVersion'>, options: { output: string, architecture: string }): MacosPantryArtifact {
  const plan = macosReleasePlan({ output: options.output, appName: config.appName, version: config.version, architecture: options.architecture })
  return {
    path: plan.dmg,
    appPath: join(options.output, `${config.appName}.app`),
    name: config.executable,
    bundleId: config.bundleId,
    version: config.version,
    buildNumber: config.buildNumber,
    target: 'macos',
    minimumSystemVersion: config.minimumSystemVersion,
  }
}
