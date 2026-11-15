import type { DesktopUpdateManifest, ReleaseRecord, ReleaseRecordDownload, UpdateStore } from '@stacksjs/desktop-build'
import type { DesktopTargetName, DesktopUpdatesConfig } from '@stacksjs/types'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import {
  artifactUrlProblem,
  compareVersions,
  describeArtifact,
  mergeReleaseRecord,
  publishDesktopUpdate,
  publishedArtifactUrl,
  releaseArtifactFormat,
  releaseRecordKey,
  releaseVersionProblem,
  splitDesktopTarget,
  storageUpdateStore,
  updateArtifactKey,
  updateManifestKey,
  updatePublicKey,
  validateUpdateManifest,
} from '@stacksjs/desktop-build'

/**
 * The half of `buddy release:desktop` that is the same for a web view app
 * (build/desktop-release.ts) and a native macOS one
 * (build/desktop-release-macos.ts): which key signs, where a release is
 * stored, what refuses it before anything is uploaded, and the publish itself.
 * One storage layout and one manifest format, so the feed and a download page
 * read either kind of app the same way.
 */

/** One target's artifacts, made and ready to publish. */
export interface PlannedRelease {
  target: DesktopTargetName
  /** Where its artifacts and its `latest.json` are staged. */
  directory: string
  /** The file an installed app updates from. */
  update: string
  /** What a person downloads, the usual choice first. */
  downloads: string[]
}

export interface ReleaseDestination {
  store: UpdateStore
  updates: DesktopUpdatesConfig
  channel: string
  prefix: string
  dryRun: boolean
}

/** The key a release signs with: `DESKTOP_UPDATE_PRIVATE_KEY`, which has to be the private half of a key the app trusts. */
export function releaseSigningKey(updates: DesktopUpdatesConfig, section: string, privateKey: string | undefined = process.env.DESKTOP_UPDATE_PRIVATE_KEY): { privateKey: string, keyId: string } {
  if (!privateKey) throw new Error('DESKTOP_UPDATE_PRIVATE_KEY is not set. It is the private half `buddy desktop:update:keypair` printed.')
  const publicKey = updatePublicKey(privateKey)
  const keyId = Object.entries(updates.publicKeys).find(([, key]) => key === publicKey)?.[0]
  if (!keyId) throw new Error(`DESKTOP_UPDATE_PRIVATE_KEY does not match any key in ${section}.publicKeys: installed apps would refuse what it signs.`)
  return { privateKey, keyId }
}

/** The disk a release is written to. A dry run writes nowhere and names its URLs on a host that cannot resolve. */
export async function releaseStore(updates: DesktopUpdatesConfig, dryRun: boolean): Promise<UpdateStore> {
  return dryRun
    ? { read: async () => null, write: async () => {}, publicUrl: async key => `https://dry-run.invalid/${key}` }
    : storageUpdateStore(updates.disk)
}

/**
 * Why a target cannot be released at this version, thrown before anything is
 * built into an artifact: the URL its manifest would name is on this machine
 * (`DESKTOP_RELEASE_ALLOW_LOCAL_URL=1` lets one through, for rehearsing
 * against a local server), or the feed already serves this version or a newer
 * one. A feed never goes backwards and never serves two builds under one number.
 */
export async function assertReleasable(destination: ReleaseDestination, section: string, target: DesktopTargetName, version: string, updateFile: string): Promise<void> {
  const { platform, architecture } = splitDesktopTarget(target)
  const location = { platform, architecture, channel: destination.channel, prefix: destination.prefix }
  const { updates, store } = destination
  const existing = await store.read(updateManifestKey(location))
  const url = await publishedArtifactUrl({ store, artifactBaseUrl: updates.artifactBaseUrl, feedUrl: updates.feedUrl, ...location }, version, basename(updateFile))
  const unreachable = artifactUrlProblem(url)
  if (unreachable && process.env.DESKTOP_RELEASE_ALLOW_LOCAL_URL !== '1')
    throw new Error(`${target}: ${unreachable}. Set ${section}.${updates.artifactBaseUrl ? 'artifactBaseUrl' : 'feedUrl'} to the address the app is served from.`)
  const problem = releaseVersionProblem(version, existing ? validateUpdateManifest(JSON.parse(existing)).version : null, compareVersions)
  if (problem) throw new Error(`${target}: ${problem}`)
}

export interface PublishReleaseOptions extends ReleaseDestination {
  planned: PlannedRelease[]
  appName: string
  version: string
  sourceRevision: string
  privateKey: string
  keyId: string
  notes?: string
  /** Where `release.json` is kept locally, beside the staged targets. */
  releaseDir: string
}

/**
 * Publish every planned target: its other downloads, then the artifact an app
 * updates from with the signed manifest that names it, then the channel's
 * `release.json`. Called only once every target's artifacts are made and
 * verified, so a failure on the last one does not leave the first in the feed.
 */
export async function publishPlannedReleases(options: PublishReleaseOptions): Promise<Array<{ target: DesktopTargetName, manifest: DesktopUpdateManifest, downloads: ReleaseRecordDownload[] }>> {
  const { store, updates, channel, prefix, dryRun, version } = options
  const published: Array<{ target: DesktopTargetName, manifest: DesktopUpdateManifest, downloads: ReleaseRecordDownload[] }> = []
  for (const item of options.planned) {
    const { platform, architecture } = splitDesktopTarget(item.target)
    const location = { platform, architecture, channel, prefix }
    // Uploaded before the manifest that announces the version. The installer the app updates from is one of them on
    // Linux and Windows; the manifest's own publish uploads that one.
    const others = new Map<string, ReleaseRecordDownload>()
    for (const file of item.downloads) {
      if (file === item.update) continue
      const key = updateArtifactKey(location, version, basename(file))
      await store.write(key, readFileSync(file))
      const { sha256, size } = await describeArtifact(file)
      const url = await publishedArtifactUrl({ store, artifactBaseUrl: updates.artifactBaseUrl, feedUrl: updates.feedUrl, ...location }, version, basename(file))
      others.set(file, { name: basename(file), format: releaseArtifactFormat(file), url, sha256, bytes: size })
    }
    const manifest = await publishDesktopUpdate({
      store,
      artifact: item.update,
      version,
      sourceRevision: options.sourceRevision,
      privateKey: options.privateKey,
      keyId: options.keyId,
      notes: options.notes,
      artifactBaseUrl: updates.artifactBaseUrl,
      feedUrl: updates.feedUrl,
      ...location,
    })
    // Kept beside the artifacts, so a dry run shows exactly what the feed would serve.
    writeFileSync(join(item.directory, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    const downloads = item.downloads.map(file => others.get(file) ?? { name: basename(file), format: releaseArtifactFormat(file), url: manifest.url, sha256: manifest.sha256, bytes: manifest.size })
    published.push({ target: item.target, manifest, downloads })
    await log.success(`${item.target}: ${dryRun ? 'would publish' : 'published'} ${basename(item.update)} (${manifest.size} bytes, sha256 ${manifest.sha256})`)
  }

  // What a download page reads: every platform's installers for this version, in one file. A release is often made
  // in several runs (the Mac here, the Linux and Windows installers from where they were built), so a run adds its
  // targets to the record of the same version and channel instead of replacing it.
  const thisRun: ReleaseRecord = {
    version,
    channel,
    sourceRevision: options.sourceRevision,
    publishedAt: new Date().toISOString(),
    targets: published.map(item => ({ target: item.target, update: { name: basename(item.manifest.url), format: releaseArtifactFormat(item.manifest.url), url: item.manifest.url, sha256: item.manifest.sha256, bytes: item.manifest.size }, downloads: item.downloads })),
  }
  const recordKey = releaseRecordKey({ channel, prefix })
  const localRecord = join(options.releaseDir, 'release.json')
  // The published record is the one that counts; a dry run has only its own earlier one to add to.
  const stored = dryRun ? (existsSync(localRecord) ? readFileSync(localRecord, 'utf8') : null) : await store.read(recordKey)
  const summary = mergeReleaseRecord(stored, thisRun)
  mkdirSync(options.releaseDir, { recursive: true })
  writeFileSync(localRecord, `${JSON.stringify(summary, null, 2)}\n`)
  if (!dryRun) await store.write(recordKey, `${JSON.stringify(summary, null, 2)}\n`)

  await log.success(dryRun ? `Dry run: nothing was notarized or uploaded. See ${options.releaseDir}` : `Released ${options.appName} ${version} on ${channel} for ${published.map(item => item.target).join(', ')}`)
  return published
}

/**
 * Refuse a release whose build did not come out of a clean checkout of HEAD:
 * an uncommitted edit would ship with nothing naming it.
 * `DESKTOP_RELEASE_ALLOW_DIRTY=1` (`--allow-dirty`) lets it through.
 */
export function assertReleaseSource(root: string, sourceRevision: string): void {
  if (process.env.DESKTOP_RELEASE_ALLOW_DIRTY === '1') return
  const dirty = Bun.spawnSync(['git', 'status', '--porcelain'], { cwd: root, stdout: 'pipe' }).stdout.toString().trim()
  const head = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root, stdout: 'pipe' }).stdout.toString().trim()
  if (dirty) throw new Error(`The working tree is not clean, and the build came out of it. Commit these first:\n${dirty}`)
  if (head !== sourceRevision) throw new Error(`The build is from ${sourceRevision.slice(0, 12)} but HEAD is ${head.slice(0, 12)}. Build again.`)
}
