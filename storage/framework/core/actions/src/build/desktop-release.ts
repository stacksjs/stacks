import type { DesktopTargetName } from '@stacksjs/types'
import type { PlannedRelease } from './desktop-release-shared'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import {
  DEFAULT_UPDATE_PREFIX,
  desktopUpdatesCollision,
  developerIdProblem,
  loadDesktopConfig,
  loadWebviewDesktop,
  releaseArtifactNames,
  resignWebviewMacosApp,
  resolveDmgPackaging,
  splitDesktopTarget,
} from '@stacksjs/desktop-build'
import { projectPath } from '@stacksjs/path'
import { assertReleasable, assertReleaseSource, publishPlannedReleases, releaseSigningKey, releaseStore } from './desktop-release-shared'
import { notaryArguments, packageMacRelease } from './notarize'

/**
 * `buddy release:desktop`, after `build:desktop` has run for the same
 * targets: make each target's release artifacts, sign one update manifest per
 * platform and architecture, and publish both through `@stacksjs/storage`.
 *
 * Everything that can refuse a release is checked before anything is
 * notarized or uploaded: a published artifact is downloaded by installed apps
 * within the day, and cannot be taken back.
 *
 * - darwin: the `.app` must be signed with a Developer ID. It is notarized and
 *   stapled, zipped (what an installed app updates from) and imaged into a
 *   signed, notarized DMG (what a person downloads).
 * - win32: the MSI `build:desktop --package` made on Windows, signed there
 *   when a certificate is configured.
 * - linux: the AppImage (what an installed app updates from), and the deb and
 *   rpm beside it.
 *
 * Artifact URLs go into a signed manifest, so they are settled first: under
 * `webview.updates.artifactBaseUrl` when a bucket or CDN serves the disk, else
 * through the route beside the feed (`<feedUrl>/files/...`), which streams
 * from any disk. A URL on this machine is refused: no installed app could
 * download from it. `DESKTOP_RELEASE_ALLOW_LOCAL_URL=1` lets one through, for
 * rehearsing a release against a local server.
 *
 * `DESKTOP_RELEASE_DRY_RUN=1` does all of it except notarizing and uploading,
 * and writes the signed manifests to the release folder instead.
 */
process.exitCode = 1

const root = projectPath()
const pkg = existsSync(join(root, 'package.json')) ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: string } : {}
const config = await loadWebviewDesktop(root, pkg.version)
if (!config) throw new Error('config/desktop.ts has no webview section.')
if (!config.updates) throw new Error('config/desktop.ts has no webview.updates: a release needs the feed URL and the public keys the app trusts.')
const collision = desktopUpdatesCollision((await loadDesktopConfig(root)) ?? {})
if (collision) throw new Error(collision)

const dryRun = process.env.DESKTOP_RELEASE_DRY_RUN === '1'
const updates = config.updates
const channel = process.env.DESKTOP_RELEASE_CHANNEL || config.updates.channel || 'stable'
const prefix = config.updates.prefix ?? DEFAULT_UPDATE_PREFIX
const output = resolve(root, config.output)
const releaseDir = join(output, 'release')

interface BuildRecord {
  version: string
  sourceRevision: string | null
  targets: Array<{ target: DesktopTargetName, directory: string, artifacts: Array<{ name: string }> }>
}
const buildFile = join(output, 'build.json')
if (!existsSync(buildFile)) throw new Error('Nothing was built. Run `buddy build:desktop` first, or drop --skip-build.')
const build = JSON.parse(readFileSync(buildFile, 'utf8')) as BuildRecord
if (build.version !== config.version) throw new Error(`The build is ${build.version} but the config says ${config.version}. Build again.`)
if (!build.sourceRevision || !/^[0-9a-f]{40}$/.test(build.sourceRevision)) throw new Error('A release names the commit it was built from, and this build has none. Build from a Git checkout.')
const sourceRevision = build.sourceRevision

// The build came out of the working tree: an uncommitted edit would ship with nothing naming it.
assertReleaseSource(root, sourceRevision)

const { privateKey, keyId } = releaseSigningKey(updates, 'webview.updates')

const notes = process.env.DESKTOP_RELEASE_NOTES ? readFileSync(resolve(root, process.env.DESKTOP_RELEASE_NOTES), 'utf8').trim() : undefined
const { signingIdentity, notary } = resolveDmgPackaging({ flags: {}, env: process.env })

const destination = { store: await releaseStore(updates, dryRun), updates, channel, prefix, dryRun }

interface Planned extends PlannedRelease {
  prepare: () => Promise<void>
}
const planned: Planned[] = []

for (const item of build.targets) {
  const { platform } = splitDesktopTarget(item.target)
  const directory = join(output, item.directory)
  const names = releaseArtifactNames(config, item.target)
  const staged = join(releaseDir, item.target)

  // A feed never goes backwards and never serves two builds under one number.
  await assertReleasable(destination, 'webview.updates', item.target, config.version, names.update)

  if (platform === 'darwin') {
    const app = join(directory, `${config.appName}.app`)
    if (process.platform !== 'darwin' || !existsSync(app)) throw new Error(`${item.target}: the .app is signed and notarized on macOS. Run this release on a Mac.`)
    if (!dryRun) {
      // A release other Macs open without a warning needs both. Refuse rather than publish something Gatekeeper blocks.
      if (!signingIdentity || !notary) throw new Error(`${item.target}: a release needs a Developer ID identity and notary credentials: --identity and --notary-profile (or DESKTOP_SIGNING_IDENTITY / DESKTOP_NOTARY_PROFILE).`)
      const signatureProblem = (): string | undefined => {
        const signature = Bun.spawnSync(['codesign', '-dvv', app], { stderr: 'pipe' })
        return developerIdProblem(`${signature.stdout.toString()}${signature.stderr.toString()}`)
      }
      // A build signs with the first identity it finds unless told, often a development one. The release was given
      // the identity to ship with, so the bundle is signed again with it here, before anything is notarized.
      if (signatureProblem()) {
        await log.info(`${item.target}: signing ${config.appName}.app with ${signingIdentity}`)
        resignWebviewMacosApp({ appPath: app, config, signingIdentity, entitlementsPath: join(directory, `${config.appName}.entitlements`) })
      }
      const unsigned = signatureProblem()
      if (unsigned) throw new Error(`${item.target}: ${app} cannot be notarized: ${unsigned} It was signed with "${signingIdentity}": --identity (or DESKTOP_SIGNING_IDENTITY) must name a Developer ID Application certificate.`)
    }
    const dmg = join(staged, names.downloads[0]!)
    planned.push({
      target: item.target,
      directory: staged,
      update: join(staged, names.update),
      downloads: [dmg],
      prepare: async () => {
        const scratch = mkdtempSync(join(tmpdir(), 'stacks-desktop-release-'))
        try {
          await packageMacRelease({
            app, appName: config.appName, updateZip: join(staged, names.update), dmg, scratch,
            ...(dryRun ? {} : { signingIdentity, ...(notary ? { auth: notaryArguments(notary) } : {}) }),
          })
        }
        finally {
          rmSync(scratch, { recursive: true, force: true })
        }
      },
    })
    continue
  }

  const packages = join(directory, 'packages')
  const made = item.artifacts.map(artifact => join(directory, artifact.name))
  const find = (extension: string): string | undefined => made.find(file => file.toLowerCase().endsWith(extension) && existsSync(file))
  const wanted = platform === 'win32' ? '.msi' : '.appimage'
  const installer = find(wanted)
  if (!installer) {
    throw new Error(`${item.target}: there is no ${platform === 'win32' ? 'MSI' : 'AppImage'} in ${packages}. Run \`buddy build:desktop --target ${item.target} --package\` on ${platform === 'win32' ? 'Windows' : 'Linux'}, then release with --skip-build.`)
  }
  // What a person downloads, the usual choice first: the installer the app also updates from, then the other
  // packages that were built. Each is staged under its release name, matched by its kind and not by its position.
  const staging = names.downloads
    .map(name => ({ name, from: name === names.update ? installer : find(name.slice(name.lastIndexOf('.')).toLowerCase()) }))
    .filter((entry): entry is { name: string, from: string } => Boolean(entry.from))
  planned.push({
    target: item.target,
    directory: staged,
    update: join(staged, names.update),
    downloads: staging.map(entry => join(staged, entry.name)),
    prepare: async () => {
      copyFileSync(installer, join(staged, names.update))
      for (const entry of staging) if (entry.name !== names.update) copyFileSync(entry.from, join(staged, entry.name))
    },
  })
}

if (!planned.length) throw new Error('The build has no targets to release.')

// Every target's artifacts are made and verified before any is published, so a
// failure on the last one does not leave the first already in the feed.
// Only this run's targets are cleared: a release made in several runs keeps the artifacts of the others.
for (const item of planned) {
  rmSync(item.directory, { recursive: true, force: true })
  mkdirSync(item.directory, { recursive: true })
  await log.info(`Preparing ${item.target}`)
  await item.prepare()
}

await publishPlannedReleases({ ...destination, planned, appName: config.appName, version: config.version, sourceRevision, privateKey, keyId, notes, releaseDir })
process.exitCode = 0
