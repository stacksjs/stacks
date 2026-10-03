/**
 * The macOS desktop lifecycle, run against a PUBLISHED Craft release archive
 * (stacksjs/stacks#2059).
 *
 * The matrix's original lifecycle evidence came from Craft's own
 * `scripts/native-lifecycle.ts --install`, run in CI against Craft v0.0.48
 * built from source. That harness packages a `bun build --compile` fixture with
 * Craft's TypeScript packager and never touches the native Craft binary, so
 * "re-run it on a published archive" needs a harness that actually ships one.
 * This is that harness. It follows the same steps and step names, so
 * stacksjs/protocol's `validateLifecycleReport` accepts its report, with these
 * differences, every one recorded in the report:
 *
 *  1. The packaged app bundles the published `craft` binary from the release
 *     archive as `Contents/MacOS/craft-runtime`, and every "launch" opens a real
 *     Craft window from the INSTALLED bundle and waits for the page inside it to
 *     call back. A launch that only printed a version would prove nothing about
 *     the runtime.
 *  2. Installs are user-domain (`installer -target CurrentUserHomeDirectory`,
 *     and a DMG copy into `~/Applications`), so it runs without root.
 *  3. It adds a failed update - a truncated v2 package must be refused and leave
 *     the installed v2 launching - and exercises the DMG path as well as the PKG.
 *
 * Nothing is signed by this harness. The Stacks-built bundle, DMG and PKG are
 * unsigned until #2062 provides identities; the report says so.
 *
 * Usage (macOS only):
 *
 *   gh release download v0.0.107 --repo craft-native/craft \
 *     --pattern craft-darwin-arm64.zip --pattern release-manifest.json --dir <release-dir>
 *   bun storage/framework/core/desktop/evidence/lifecycle.ts \
 *     --craft-repo <any craft-native/craft clone> --release-dir <release-dir> --work <scratch-dir> \
 *     --out storage/framework/core/desktop/evidence/lifecycle-darwin-arm64.json
 *
 * The Craft clone supplies only the packager (`packages/typescript/src`, which
 * imports nothing but Node built-ins). It is exported with `git archive` at the
 * commit the release manifest names, so whatever the clone has checked out,
 * the packager is exactly the release's own.
 */

import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

interface PackageResult { success: boolean, platform: string, format: string, outputPath?: string, error?: string }
interface Step { name: string, command?: string[], status: 'passed' | 'failed' | 'skipped', output?: string, error?: string }
interface ReleaseManifest { tag: string, commit: string, assets: Array<{ name: string, sha256: string }> }

const ID = 'dev.craft.lifecycle'
const HOME = homedir()

function flag(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value)
    throw new Error(`--${name} <path> is required`)
  return resolve(value)
}

if (process.platform !== 'darwin')
  throw new Error('This lifecycle harness exercises macOS PKG and DMG installs; run it on macOS.')

const craftRepo = flag('craft-repo')
const releaseDir = flag('release-dir')
const workDir = flag('work')
const reportPath = flag('out')

const archiveName = `craft-darwin-${process.arch}.zip`
const archive = join(releaseDir, archiveName)
const manifest = JSON.parse(readFileSync(join(releaseDir, 'release-manifest.json'), 'utf8')) as ReleaseManifest
const craftVersion = manifest.tag.replace(/^v/, '')
const steps: Step[] = []
let packageApp: (config: Record<string, unknown>) => Promise<PackageResult[]>

/** Strip machine-local prefixes so the committed report does not carry them. */
function scrub(text: string): string {
  return text.replaceAll(workDir, '<work>').replaceAll(releaseDir, '<release>').replaceAll(HOME, '~')
}

function digestFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function* bundleEntries(dir: string, prefix = ''): Generator<{ relativePath: string, absolutePath: string }> {
  for (const name of readdirSync(dir).sort()) {
    const absolutePath = join(dir, name)
    const relativePath = prefix ? `${prefix}/${name}` : name
    if (lstatSync(absolutePath).isDirectory())
      yield* bundleEntries(absolutePath, relativePath)
    else
      yield { relativePath, absolutePath }
  }
}

/** The same file/tree digest Craft's harness reports, so the two are comparable. */
function sha256(path: string): { sha256: string, kind: 'file' | 'tree' } {
  if (!lstatSync(path).isDirectory())
    return { sha256: digestFile(path), kind: 'file' }
  const hash = createHash('sha256')
  for (const { relativePath, absolutePath } of bundleEntries(path)) {
    const stats = lstatSync(absolutePath)
    hash.update(relativePath)
    if (stats.isSymbolicLink()) {
      hash.update('\u0002')
      hash.update(readlinkSync(absolutePath))
    }
    else {
      hash.update(stats.mode & 0o111 ? '\u0001' : '\u0000')
      hash.update(readFileSync(absolutePath))
    }
  }
  return { sha256: hash.digest('hex'), kind: 'tree' }
}

async function command(name: string, argv: string[], expected: string[] = [], expectFailure = false): Promise<string> {
  const entry: Step = { name, command: argv.map(scrub), status: 'failed' }
  steps.push(entry)
  const proc = Bun.spawn(argv, { stdout: 'pipe', stderr: 'pipe', env: process.env })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  const output = `${stdout}${stderr}`.trim()
  entry.output = scrub(output)
  if (expectFailure) {
    if (exitCode === 0) {
      entry.error = `expected ${argv[0]} to fail; it exited 0`
      throw new Error(`${name}: ${entry.error}`)
    }
    entry.output = scrub(`exit ${exitCode} (expected non-zero)\n${output}`)
    entry.status = 'passed'
    return output
  }
  if (exitCode !== 0) {
    entry.error = `${argv[0]} exited with ${exitCode}`
    throw new Error(`${name}: ${entry.error}\n${output}`)
  }
  for (const needle of expected) {
    if (!output.includes(needle)) {
      entry.error = `expected output to include ${JSON.stringify(needle)}`
      throw new Error(`${name}: ${entry.error}; got ${JSON.stringify(output)}`)
    }
  }
  entry.status = 'passed'
  return output
}

function check(name: string, ok: boolean, output: string): void {
  steps.push({ name, status: ok ? 'passed' : 'failed', output: scrub(output), error: ok ? undefined : scrub(output) })
  if (!ok)
    throw new Error(`${name}: ${output}`)
}

/**
 * The fixture app: prints its version, then opens the bundled Craft runtime on
 * a loopback page and exits once that page has loaded and called back. A
 * window that never renders times out and fails the launch.
 */
function fixtureSource(version: string): string {
  return `import { dirname, join } from 'node:path'
const version = ${JSON.stringify(version)}
console.log('craft-lifecycle ' + version)
const runtime = join(dirname(process.execPath), 'craft-runtime')
console.log('runtime ' + Bun.spawnSync([runtime, '--version']).stdout.toString().split('\\n')[0])
let ready: (ua: string) => void
const page = new Promise<string>(r => { ready = r })
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req) {
  const url = new URL(req.url)
  if (url.pathname === '/ready') { ready(url.searchParams.get('ua') || ''); return new Response('ok') }
  return new Response('<!doctype html><title>craft-lifecycle ' + version + '</title><h1>craft-lifecycle ' + version + '</h1><script>fetch("/ready?ua="+encodeURIComponent(navigator.userAgent))</script>', { headers: { 'content-type': 'text/html' } })
} })
const craft = Bun.spawn([runtime, 'http://127.0.0.1:' + server.port + '/', '--title', 'craft-lifecycle ' + version, '--width', '480', '--height', '320'], { stdout: 'ignore', stderr: 'ignore' })
const timer = setTimeout(() => { console.log('window-timeout'); craft.kill(); process.exit(1) }, 30000)
const ua = await page
clearTimeout(timer)
console.log('window-ready ' + (ua.includes('AppleWebKit') ? 'webkit' : ua))
craft.kill()
await craft.exited
server.stop(true)
process.exit(0)
`
}

async function buildFixture(version: string): Promise<string> {
  const source = join(workDir, `fixture-${version}.ts`)
  const binary = join(workDir, `craft-lifecycle-${version}`)
  writeFileSync(source, fixtureSource(version))
  await command(`compile fixture ${version}`, ['bun', 'build', '--compile', source, '--outfile', binary])
  chmodSync(binary, 0o755)
  return binary
}

async function createPackages(version: string, binaryPath: string, runtime: string): Promise<PackageResult[]> {
  const results = await packageApp({
    name: 'craft-lifecycle',
    version,
    description: 'Craft native package lifecycle contract fixture (published runtime)',
    author: 'Stacks.js',
    binaryPath,
    outDir: join(workDir, `packages-${version}`),
    bundleId: ID,
    platforms: ['macos'],
    macos: { dmg: true, pkg: true, additionalExecutables: [runtime] },
  })
  const failures = results.filter(result => !result.success)
  if (failures.length)
    throw new Error(failures.map(result => `${result.format}: ${result.error}`).join('\n'))
  steps.push({ name: `package fixture ${version}`, status: 'passed', output: scrub(results.map(result => result.outputPath).join('\n')) })
  return results
}

function artifact(results: PackageResult[], format: string): string {
  const result = results.find(candidate => candidate.format === format)
  if (!result?.success || !result.outputPath || !existsSync(result.outputPath))
    throw new Error(`packager did not produce a ${format}`)
  return result.outputPath
}

const app = join(HOME, 'Applications', 'craft-lifecycle.app')
const executable = join(app, 'Contents', 'MacOS', 'craft-lifecycle')
const installedRuntime = join(app, 'Contents', 'MacOS', 'craft-runtime')
const launched = (version: string): string[] => [`craft-lifecycle ${version}`, `runtime craft version ${craftVersion}`, 'window-ready webkit']
const install = (name: string, pkg: string, expectFailure = false): Promise<string> =>
  command(name, ['installer', '-pkg', pkg, '-target', 'CurrentUserHomeDirectory'], [], expectFailure)
const forget = (name: string): Promise<string> => command(name, ['pkgutil', '--volume', HOME, '--forget', ID])

// The package installs relative to its target volume (`--install-location /`),
// so a user-domain install lands in ~/Applications and the receipt names the
// home volume rather than a location.
async function receipt(label: string): Promise<void> {
  await command(`receipt after ${label}`, ['pkgutil', '--volume', HOME, '--pkg-info', ID], [`volume: ${HOME}`])
  check(`bundle present after ${label}`, existsSync(executable), executable)
}

function runtimeIsPublished(publishedBinary: string, label: string): void {
  const installed = digestFile(installedRuntime)
  const published = digestFile(publishedBinary)
  check(`installed runtime is the published binary (${label})`, installed === published, `installed ${installed}, published ${published}`)
}

async function exercisePkg(v1: PackageResult[], v2: PackageResult[], publishedBinary: string): Promise<void> {
  const first = artifact(v1, 'pkg')
  const second = artifact(v2, 'pkg')
  await install('install v1', first)
  await receipt('install v1')
  runtimeIsPublished(publishedBinary, 'pkg v1')
  await command('launch v1', [executable], launched('1.0.0'))
  await install('update to v2', second)
  await receipt('update to v2')
  await command('launch v2', [executable], launched('1.0.1'))

  const truncated = join(workDir, 'craft-lifecycle-1.0.1-truncated.pkg')
  const bytes = readFileSync(second)
  writeFileSync(truncated, bytes.subarray(0, Math.floor(bytes.length / 2)))
  await install('failed update (truncated package) is refused', truncated, true)
  await command('launch after failed update', [executable], launched('1.0.1'))

  await command('remove current application before rollback', ['rm', '-rf', app])
  await forget('forget current receipt before rollback')
  await install('rollback to v1', first)
  await receipt('rollback to v1')
  await command('launch rollback', [executable], launched('1.0.0'))
  await command('uninstall', ['rm', '-rf', app])
  await forget('forget v1 receipt')
  check('verify uninstall', !existsSync(app), existsSync(app) ? `${app} left behind` : `${app} removed and its receipt forgotten`)
}

async function exerciseDmg(v1: PackageResult[], v2: PackageResult[], publishedBinary: string): Promise<void> {
  const mount = join(workDir, 'mnt')
  const copy = async (label: string, dmg: string): Promise<void> => {
    mkdirSync(mount, { recursive: true })
    await command(`dmg: attach (${label})`, ['hdiutil', 'attach', dmg, '-readonly', '-nobrowse', '-mountpoint', mount])
    try {
      if (existsSync(app))
        await command(`dmg: remove previous bundle (${label})`, ['rm', '-rf', app])
      await command(`dmg: ${label}`, ['ditto', join(mount, 'craft-lifecycle.app'), app])
    }
    finally {
      await command(`dmg: detach (${label})`, ['hdiutil', 'detach', mount])
    }
  }
  await copy('install v1', artifact(v1, 'dmg'))
  runtimeIsPublished(publishedBinary, 'dmg v1')
  await command('dmg: launch v1', [executable], launched('1.0.0'))
  await copy('update to v2', artifact(v2, 'dmg'))
  await command('dmg: launch v2', [executable], launched('1.0.1'))
  await copy('rollback to v1', artifact(v1, 'dmg'))
  await command('dmg: launch rollback', [executable], launched('1.0.0'))
  await command('dmg: uninstall', ['rm', '-rf', app])
  check('dmg: verify uninstall', !existsSync(app), existsSync(app) ? `${app} left behind` : `${app} removed`)
}

async function main(): Promise<void> {
  if (existsSync(app))
    throw new Error(`${app} already exists; refusing to overwrite it`)
  rmSync(workDir, { recursive: true, force: true })
  mkdirSync(workDir, { recursive: true })

  let error: string | undefined
  let packages: PackageResult[] = []
  const provenance: Record<string, unknown> = {}
  try {
    const archiveSha256 = digestFile(archive)
    const listed = manifest.assets.find(asset => asset.name === archiveName)?.sha256
    check('published archive matches release-manifest.json', archiveSha256 === listed, `${archiveSha256} (manifest: ${listed})`)
    await command('release commit is known to the craft clone', ['git', '-C', craftRepo, 'cat-file', '-e', `${manifest.commit}^{commit}`])
    const packager = join(workDir, 'craft-packager')
    mkdirSync(packager, { recursive: true })
    const exported = Bun.spawnSync(['sh', '-c', `git -C "$0" archive "$1" packages/typescript/src | tar -x -C "$2"`, craftRepo, manifest.commit, packager])
    check('export the packager at the release commit', exported.exitCode === 0, exported.stderr.toString() || `packages/typescript/src @ ${manifest.commit}`)
    packageApp = (await import(join(packager, 'packages/typescript/src/package.ts'))).packageApp

    const unpacked = join(workDir, 'archive')
    await command('unpack published archive', ['ditto', '-x', '-k', archive, unpacked])
    const publishedBinary = join(unpacked, 'craft')
    const version = await command('published runtime version', [publishedBinary, '--version'], [`craft version ${craftVersion}`])
    await command('published runtime signature verifies', ['codesign', '--verify', '--strict', publishedBinary])
    const details = Bun.spawnSync(['codesign', '-dvv', publishedBinary]).stderr.toString()
    Object.assign(provenance, {
      release: `https://github.com/craft-native/craft/releases/tag/${manifest.tag}`,
      archive: archiveName,
      archiveSha256,
      releaseCommit: manifest.commit,
      packager: `craft-native/craft packages/typescript/src @ ${manifest.commit} (git archive)`,
      runtimeVersion: version.split('\n')[0],
      runtimeBinarySha256: digestFile(publishedBinary),
      runtimeSigningAuthority: details.match(/Authority=([^\n]+)/)?.[1] ?? null,
    })

    const runtime = join(workDir, 'craft-runtime')
    copyFileSync(publishedBinary, runtime)
    chmodSync(runtime, 0o755)
    const v1Binary = await buildFixture('1.0.0')
    const v2Binary = await buildFixture('1.0.1')
    const v1 = await createPackages('1.0.0', v1Binary, runtime)
    const v2 = await createPackages('1.0.1', v2Binary, runtime)
    packages = [...v1, ...v2]
    await command('fixture app bundle is unsigned', ['codesign', '--verify', join(workDir, 'packages-1.0.0', 'craft-lifecycle.app')], [], true)
    await command('fixture pkg is unsigned', ['pkgutil', '--check-signature', artifact(v1, 'pkg')], [], true)

    await exercisePkg(v1, v2, publishedBinary)
    await exerciseDmg(v1, v2, publishedBinary)
  }
  catch (caught) {
    error = scrub(caught instanceof Error ? caught.stack || caught.message : String(caught))
  }

  const artifacts = packages
    .filter(result => result.success && result.outputPath && existsSync(result.outputPath))
    .map((result) => {
      const digest = sha256(result.outputPath!)
      return { platform: result.platform, format: result.format, path: scrub(result.outputPath!), sha256: digest.sha256, sha256Kind: digest.kind }
    })

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    // `revision` is what stacksjs/protocol's validator pins; for a published
    // archive it is the commit the release was cut from.
    revision: manifest.commit,
    craftSource: 'published-archive',
    craftRelease: manifest.tag,
    provenance,
    orchestratorRevision: null,
    runner: {
      os: process.platform,
      arch: process.arch,
      bun: Bun.version,
      macos: Bun.spawnSync(['sw_vers', '-productVersion']).stdout.toString().trim(),
      host: process.env.CI ? 'ci' : 'local',
    },
    installLifecycleExercised: true,
    installDomain: 'user (installer -target CurrentUserHomeDirectory; DMG copied into ~/Applications)',
    signed: false,
    status: error ? 'failed' : 'passed',
    artifacts,
    steps,
    error,
  }
  mkdirSync(resolve(reportPath, '..'), { recursive: true })
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  for (const step of steps)
    console.log(`${step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '-'} ${step.name}`)
  if (error) {
    console.error(error)
    process.exit(1)
  }
}

await main()
