import type { DesktopTargetName } from '@stacksjs/types'
import type { PlannedRelease } from './desktop-release-shared'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import {
  DEFAULT_UPDATE_PREFIX,
  desktopUpdatesCollision,
  developerIdProblem,
  loadDesktopConfig,
  loadMacosDesktop,
  macosOutputDirectory,
  macosReleasePlan,
  readMacosBuildRecord,
  resolveDmgPackaging,
  validateMacosDesktop,
} from '@stacksjs/desktop-build'
import { projectPath } from '@stacksjs/path'
import { assertReleasable, assertReleaseSource, publishPlannedReleases, releaseSigningKey, releaseStore } from './desktop-release-shared'
import { notaryArguments, packageMacRelease } from './notarize'

/**
 * `buddy release:desktop` for a project whose `config/desktop.ts` declares a
 * `macos` app, after `build:desktop` built it with
 * `DESKTOP_DISTRIBUTION=developer-id`: notarize and staple the `.app`, zip it
 * (what an installed app updates from), image it into a signed, notarized DMG
 * (what a person downloads), sign the update manifest and publish, in the
 * same storage layout and manifest format as a web view app
 * (build/desktop-release.ts), so one feed serves either.
 *
 * Everything that can refuse a release is checked before anything is
 * notarized or uploaded: the build is the Developer ID one, at the version
 * the config names, from a clean checkout of HEAD; the signing key is one the
 * app trusts; the feed does not already serve this version or a newer one.
 *
 * `DESKTOP_RELEASE_DRY_RUN=1` does all of it except notarizing and uploading,
 * and writes the signed manifest to the release folder instead.
 *
 * `DESKTOP_RELEASE_PACKAGE_ONLY=1` (`--package-only`) stops at the signed app
 * and a signed DMG: nothing is notarized, signed for the feed or published.
 * With no identity to sign with it packages an ad hoc build, which Pantry's
 * check of a pull request accepts and its release refuses.
 * It is what Pantry's native app pipeline runs as its build
 * (`pantry.json` `native.build`): Pantry notarizes, staples and assesses the
 * result itself, and reads where it is from `.pantry/native/artifact.json`,
 * which the command writes once this action has succeeded.
 */
process.exitCode = 1

if (process.platform !== 'darwin') throw new Error('A native macOS app is signed and notarized on macOS. Run this release on a Mac.')

const root = projectPath()
const pkg = existsSync(join(root, 'package.json')) ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: string } : {}
const config = await loadMacosDesktop(root, pkg.version)
if (!config) throw new Error('config/desktop.ts has no macos section.')
const errors = validateMacosDesktop(config)
if (errors.length) throw new Error(`config/desktop.ts macos cannot be released:\n${errors.map(error => `  - ${error}`).join('\n')}`)

const dryRun = process.env.DESKTOP_RELEASE_DRY_RUN === '1'
const packageOnly = process.env.DESKTOP_RELEASE_PACKAGE_ONLY === '1'
if (dryRun && packageOnly) throw new Error('--package-only publishes nothing, so there is nothing for --dry-run to hold back. Pass one of them.')
const updates = config.updates
if (!updates && !packageOnly)
  throw new Error('config/desktop.ts has no macos.updates: a release needs the feed URL and the public keys the app trusts. `--package-only` makes the signed app and DMG without a feed.')
if (updates && !packageOnly) {
  const collision = desktopUpdatesCollision((await loadDesktopConfig(root)) ?? {})
  if (collision) throw new Error(collision)
}

const output = macosOutputDirectory(root, config)
const app = join(output, `${config.appName}.app`)
const build = readMacosBuildRecord(output, config.appName)
if (!build || !existsSync(app)) throw new Error('Nothing was built. Run this without --skip-build, which builds the Developer ID app first.')
if (build.version !== config.version) throw new Error(`The build is ${build.version} but the config says ${config.version}. Build again.`)
if (build.distribution !== 'developer-id')
  throw new Error(`${app} was built for ${build.distribution}, not for release. Drop --skip-build: the release builds the Developer ID app itself.`)
if (updates && !packageOnly && !build.updater)
  throw new Error(`${app} was built without the updater, so the release it published would be the last one it ever installed. Build again with a craft-native that has it.`)

const { target, staged, update, dmg } = macosReleasePlan({ output, appName: config.appName, version: config.version, architecture: build.architecture })
const releaseDir = join(output, 'release')

let sourceRevision = ''
if (!packageOnly) {
  if (!build.sourceRevision || !/^[0-9a-f]{40}$/.test(build.sourceRevision)) throw new Error('A release names the commit it was built from, and this build has none. Build from a Git checkout.')
  sourceRevision = build.sourceRevision
  // The build came out of the working tree: an uncommitted edit would ship with nothing naming it.
  assertReleaseSource(root, sourceRevision)
}

// The signature says now what Apple's notary service would say after minutes of upload.
// A package-only build made with no identity at all is a check, not a release, and says so below.
const unsignedPackage = packageOnly && build.signedWith === 'ad hoc'
if (!dryRun && !unsignedPackage) {
  const signature = Bun.spawnSync(['codesign', '-dvv', app], { stderr: 'pipe' })
  const problem = developerIdProblem(`${signature.stdout.toString()}${signature.stderr.toString()}`)
  if (problem) throw new Error(`${app} cannot be released: ${problem} Build again with --identity (or DESKTOP_SIGNING_IDENTITY) naming a Developer ID Application certificate.`)
}

// The disk image is signed with what signed the app, unless this run names another.
const signingIdentity = process.env.DESKTOP_SIGNING_IDENTITY || process.env.APPLE_SIGNING_IDENTITY || (build.signedWith === 'ad hoc' ? undefined : build.signedWith)
// A release is notarized, so the App Store Connect key is used without `--notarize` having to ask for it.
const notary = dryRun || packageOnly ? undefined : resolveDmgPackaging({ flags: { notarize: true }, env: process.env }).notary

const planned: PlannedRelease = { target: target as DesktopTargetName, directory: staged, update, downloads: [dmg] }

const publishing = updates && !packageOnly
  ? {
      updates,
      key: releaseSigningKey(updates, 'macos.updates'),
      destination: {
        store: await releaseStore(updates, dryRun),
        updates,
        channel: process.env.DESKTOP_RELEASE_CHANNEL || updates.channel || 'stable',
        prefix: updates.prefix ?? DEFAULT_UPDATE_PREFIX,
        dryRun,
      },
      notes: process.env.DESKTOP_RELEASE_NOTES ? readFileSync(resolve(root, process.env.DESKTOP_RELEASE_NOTES), 'utf8').trim() : undefined,
    }
  : undefined
// A feed never goes backwards and never serves two builds under one number.
if (publishing) await assertReleasable(publishing.destination, 'macos.updates', planned.target, config.version, update)

rmSync(staged, { recursive: true, force: true })
mkdirSync(staged, { recursive: true })
await log.info(`Preparing ${target}`)
const scratch = mkdtempSync(join(tmpdir(), 'stacks-desktop-release-'))
try {
  await packageMacRelease({
    app, appName: config.appName, dmg, scratch,
    // The update archive carries the stapled ticket, which a package-only run does not have yet.
    ...(packageOnly ? {} : { updateZip: update }),
    ...(dryRun ? {} : { signingIdentity, ...(notary ? { auth: notaryArguments(notary) } : {}) }),
  })
}
finally {
  rmSync(scratch, { recursive: true, force: true })
}

if (publishing) {
  await publishPlannedReleases({
    ...publishing.destination, planned: [planned], appName: config.appName, version: config.version, sourceRevision,
    privateKey: publishing.key.privateKey, keyId: publishing.key.keyId, notes: publishing.notes, releaseDir,
  })
}
else {
  await log.success(`Packaged ${dmg}`)
  if (unsignedPackage) await log.warn('Signed ad hoc, so this package can be checked and cannot be released. Give the build a Developer ID Application identity (APPLE_SIGNING_IDENTITY, DESKTOP_SIGNING_IDENTITY or --identity).')
  else await log.info('Signed with Developer ID, not notarized and not published: `--package-only` leaves both to what runs it (Pantry\'s native app pipeline).')
}
process.exitCode = 0
