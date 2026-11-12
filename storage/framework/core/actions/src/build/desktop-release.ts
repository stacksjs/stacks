import type { DesktopUpdateManifest, UpdateStore } from '@stacksjs/desktop-build'
import type { DesktopTargetName } from '@stacksjs/types'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import {
  artifactUrlProblem,
  compareVersions,
  DEFAULT_UPDATE_PREFIX,
  describeArtifact,
  developerIdProblem,
  loadWebviewDesktop,
  publishDesktopUpdate,
  publishedArtifactUrl,
  releaseArtifactNames,
  releaseVersionProblem,
  resolveDmgPackaging,
  splitDesktopTarget,
  storageUpdateStore,
  updateArtifactKey,
  updateManifestKey,
  updatePublicKey,
  validateUpdateManifest,
} from '@stacksjs/desktop-build'
import { projectPath } from '@stacksjs/path'
import { imageDmg, notarizeAndStaple, notaryArguments } from './notarize'

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
const dirty = Bun.spawnSync(['git', 'status', '--porcelain'], { cwd: root, stdout: 'pipe' }).stdout.toString().trim()
const head = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root, stdout: 'pipe' }).stdout.toString().trim()
if (process.env.DESKTOP_RELEASE_ALLOW_DIRTY !== '1') {
  if (dirty) throw new Error(`The working tree is not clean, and the build came out of it. Commit these first:\n${dirty}`)
  if (head !== sourceRevision) throw new Error(`The build is from ${sourceRevision.slice(0, 12)} but HEAD is ${head.slice(0, 12)}. Build again.`)
}

const privateKey = process.env.DESKTOP_UPDATE_PRIVATE_KEY
if (!privateKey) throw new Error('DESKTOP_UPDATE_PRIVATE_KEY is not set. It is the private half `buddy desktop:update:keypair` printed.')
const publicKey = updatePublicKey(privateKey)
const keyId = Object.entries(config.updates.publicKeys).find(([, key]) => key === publicKey)?.[0]
if (!keyId) throw new Error('DESKTOP_UPDATE_PRIVATE_KEY does not match any key in webview.updates.publicKeys: installed apps would refuse what it signs.')

const notes = process.env.DESKTOP_RELEASE_NOTES ? readFileSync(resolve(root, process.env.DESKTOP_RELEASE_NOTES), 'utf8').trim() : undefined
const { signingIdentity, notary } = resolveDmgPackaging({ flags: {}, env: process.env })

const store: UpdateStore = dryRun
  ? { read: async () => null, write: async () => {}, publicUrl: async key => `https://dry-run.invalid/${key}` }
  : await storageUpdateStore(config.updates.disk)

const artifactUrl = (location: { platform: string, architecture: string, channel: string, prefix: string }, file: string): Promise<string> =>
  publishedArtifactUrl({ store, artifactBaseUrl: updates.artifactBaseUrl, feedUrl: updates.feedUrl, ...location }, config.version, basename(file))

interface Planned {
  target: DesktopTargetName
  directory: string
  /** The file an installed app updates from, once made. */
  update: string
  downloads: string[]
  prepare: () => Promise<void>
}
const planned: Planned[] = []

for (const item of build.targets) {
  const { platform, architecture } = splitDesktopTarget(item.target)
  const directory = join(output, item.directory)
  const names = releaseArtifactNames(config, item.target)
  const staged = join(releaseDir, item.target)
  const location = { platform, architecture, channel, prefix }

  // A feed never goes backwards and never serves two builds under one number.
  const existing = await store.read(updateManifestKey(location))
  const unreachable = artifactUrlProblem(await artifactUrl(location, names.update))
  if (unreachable && process.env.DESKTOP_RELEASE_ALLOW_LOCAL_URL !== '1') {
    throw new Error(`${item.target}: ${unreachable}. Set webview.updates.${updates.artifactBaseUrl ? 'artifactBaseUrl' : 'feedUrl'} to the address the app is served from.`)
  }

  const problem = releaseVersionProblem(config.version, existing ? validateUpdateManifest(JSON.parse(existing)).version : null, compareVersions)
  if (problem) throw new Error(`${item.target}: ${problem}`)

  if (platform === 'darwin') {
    const app = join(directory, `${config.appName}.app`)
    if (process.platform !== 'darwin' || !existsSync(app)) throw new Error(`${item.target}: the .app is signed and notarized on macOS. Run this release on a Mac.`)
    if (!dryRun) {
      // A release other Macs open without a warning needs both. Refuse rather than publish something Gatekeeper blocks.
      if (!signingIdentity || !notary) throw new Error(`${item.target}: a release needs a Developer ID identity and notary credentials: --identity and --notary-profile (or DESKTOP_SIGNING_IDENTITY / DESKTOP_NOTARY_PROFILE).`)
      const signature = Bun.spawnSync(['codesign', '-dvv', app], { stderr: 'pipe' })
      const unsigned = developerIdProblem(`${signature.stdout.toString()}${signature.stderr.toString()}`)
      if (unsigned) throw new Error(`${item.target}: ${app} cannot be notarized: ${unsigned}`)
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
          const auth = !dryRun && notary ? notaryArguments(notary) : undefined
          if (auth) await notarizeAndStaple(app, `${config.appName}.app`, auth, scratch)
          // After stapling, so the ticket travels inside the update. ditto keeps the signature and the ticket; zip does not.
          run(['ditto', '-c', '-k', '--keepParent', app, join(staged, names.update)])
          const staging = join(scratch, 'dmg')
          mkdirSync(staging, { recursive: true })
          cpSync(app, join(staging, `${config.appName}.app`), { recursive: true, verbatimSymlinks: true })
          await imageDmg({ staging, volumeName: config.appName, dmgPath: dmg, ...(dryRun ? {} : { signingIdentity }) })
          if (auth) {
            await notarizeAndStaple(dmg, 'the DMG', auth, scratch)
            // Checked against the file that gets uploaded, not only the build output.
            run(['codesign', '--verify', '--deep', '--strict', app])
            run(['spctl', '-a', '-t', 'open', '--context', 'context:primary-signature', dmg])
            run(['xcrun', 'stapler', 'validate', dmg])
          }
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
  const extras = platform === 'linux' ? ['.deb', '.rpm'].map(find).filter((file): file is string => Boolean(file)) : []
  planned.push({
    target: item.target,
    directory: staged,
    update: join(staged, names.update),
    downloads: extras.map((file, index) => join(staged, names.downloads[index] ?? basename(file))),
    prepare: async () => {
      copyFileSync(installer, join(staged, names.update))
      extras.forEach((file, index) => copyFileSync(file, join(staged, names.downloads[index] ?? basename(file))))
    },
  })
}

if (!planned.length) throw new Error('The build has no targets to release.')

function run(command: string[]): void {
  console.log(`> ${command.join(' ')}`)
  const result = Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' })
  if (result.exitCode !== 0) throw new Error(`${command[0]} exited with ${result.exitCode}`)
}

// Every target's artifacts are made and verified before any is published, so a
// failure on the last one does not leave the first already in the feed.
rmSync(releaseDir, { recursive: true, force: true })
for (const item of planned) {
  mkdirSync(item.directory, { recursive: true })
  await log.info(`Preparing ${item.target}`)
  await item.prepare()
}

const published: Array<{ target: DesktopTargetName, manifest: DesktopUpdateManifest, downloads: Array<{ name: string, url: string, sha256: string, bytes: number }> }> = []
for (const item of planned) {
  const { platform, architecture } = splitDesktopTarget(item.target)
  const location = { platform, architecture, channel, prefix }
  const downloads: Array<{ name: string, url: string, sha256: string, bytes: number }> = []
  for (const file of item.downloads) {
    const key = updateArtifactKey(location, config.version, basename(file))
    await store.write(key, readFileSync(file))
    const { sha256, size } = await describeArtifact(file)
    downloads.push({ name: basename(file), url: await artifactUrl(location, file), sha256, bytes: size })
  }
  const manifest = await publishDesktopUpdate({
    store,
    artifact: item.update,
    version: config.version,
    sourceRevision,
    privateKey,
    keyId,
    notes,
    artifactBaseUrl: updates.artifactBaseUrl,
    feedUrl: updates.feedUrl,
    ...location,
  })
  // Kept beside the artifacts, so a dry run shows exactly what the feed would serve.
  writeFileSync(join(item.directory, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  published.push({ target: item.target, manifest, downloads })
  await log.success(`${item.target}: ${dryRun ? 'would publish' : 'published'} ${basename(item.update)} (${manifest.size} bytes, sha256 ${manifest.sha256})`)
}

// What a download page reads: every platform's installers for this version, in one file.
const summary = {
  version: config.version,
  channel,
  sourceRevision,
  publishedAt: new Date().toISOString(),
  targets: published.map(item => ({ target: item.target, update: { url: item.manifest.url, sha256: item.manifest.sha256, bytes: item.manifest.size }, downloads: item.downloads })),
}
writeFileSync(join(releaseDir, 'release.json'), `${JSON.stringify(summary, null, 2)}\n`)
if (!dryRun) await store.write(`${prefix}/${channel}/release.json`, `${JSON.stringify(summary, null, 2)}\n`)

await log.success(dryRun ? `Dry run: nothing was notarized or uploaded. See ${releaseDir}` : `Released ${config.appName} ${config.version} on ${channel} for ${published.map(item => item.target).join(', ')}`)
process.exitCode = 0
