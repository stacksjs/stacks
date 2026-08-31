import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { corePath, projectPath, storagePath } from '@stacksjs/path'
import { assertDesktopReleaseChannel, hasUserlandDesktopLauncher, resolveCraftExecutable, resolveDesktopLauncher } from '@stacksjs/desktop-build'

const outputDir = storagePath('framework/desktop-dist')
const launcherName = process.platform === 'win32' ? 'stacks-desktop.exe' : 'stacks-desktop'
const runtimeName = process.platform === 'win32' ? 'craft-runtime.exe' : 'craft-runtime'
const appUrl = process.env.DESKTOP_URL || process.env.APP_URL
const releaseChannel = process.env.DESKTOP_RELEASE_CHANNEL === 'stable' ? 'stable' : 'experimental'
const support = assertDesktopReleaseChannel(releaseChannel)

// An app that owns its launcher decides for itself what the window opens —
// typically a server it starts on loopback, whose port is not known until it
// runs. Demanding a URL up front is only meaningful for the framework launcher,
// which has nothing else to go on.
const ownsLauncher = hasUserlandDesktopLauncher(projectPath())

if (!appUrl && !ownsLauncher) {
  throw new Error(
    'Desktop builds require APP_URL or DESKTOP_URL so the native app knows which Stacks application to open. '
    + 'An app that opens something local instead can supply its own app/Desktop/launcher.ts.',
  )
}

const url = appUrl
  ? new URL(/^https?:\/\//.test(appUrl) ? appUrl : `https://${appUrl}`)
  : null
const craftBinary = resolveCraftExecutable()

// The runtime is copied verbatim into the bundle, so it has to be the native
// executable. A dev wrapper script points at a path outside the bundle and
// would leave every shipped app broken on first launch.
if (readFileSync(craftBinary).subarray(0, 2).toString() === '#!') {
  throw new Error(
    `CRAFT_BIN points at a script, not a native binary: ${craftBinary}. `
    + 'Point it at the compiled Craft executable (packages/zig/zig-out/bin/craft).',
  )
}

if (existsSync(outputDir))
  rmSync(outputDir, { recursive: true })
mkdirSync(outputDir, { recursive: true })

// Rebuild the desktop package only when its source is present — inside this
// monorepo. A consumer app installs it prebuilt and has no `src` to compile.
const desktopSource = corePath('desktop')
if (existsSync(join(desktopSource, 'package.json')) && existsSync(join(desktopSource, 'src')))
  await runCommand('bun run build', { cwd: desktopSource })

// Argv form, not a command string: runCommand splits a string on whitespace,
// so a quoted path arrived at bun with its quotes still attached and any path
// containing a space would have split in half.
//
// `--minify` because this binary ships to users and is never read by anyone:
// measured at 6.9 MB off a real app (83.9 → 77.0 MB), with the agent serving
// its whole route tree and the worker subcommand producing identical output.
// The framework already minifies the server build and buddy's own binary.
//
// Not `--bytecode`, which sounds like it belongs here and does the opposite:
// it adds back the same 6.9 MB, trading size for startup time. Anyone reaching
// for "make it smaller" would plausibly enable both and end up where they
// started.
//
// `DESKTOP_MINIFY=false` opts out. Minification renames functions and classes,
// and a launcher can pull in arbitrary application code — anything reading
// `fn.name`, or keying on a constructor name, breaks in a way that only shows
// up in the packaged build. An app that hits that should be able to ship
// without waiting on a framework release.
const minify = process.env.DESKTOP_MINIFY !== 'false'
const launcherEntry = resolveDesktopLauncher(projectPath())
await runCommand(
  [
    'bun',
    'build',
    '--compile',
    ...(minify ? ['--minify'] : []),
    launcherEntry,
    '--outfile',
    join(outputDir, launcherName),
  ],
  { cwd: projectPath() },
)

copyFileSync(craftBinary, join(outputDir, runtimeName))
if (process.platform !== 'win32') {
  chmodSync(join(outputDir, launcherName), 0o755)
  chmodSync(join(outputDir, runtimeName), 0o755)
}

writeFileSync(join(outputDir, 'desktop.json'), `${JSON.stringify({
  url: url ? url.toString().replace(/\/$/, '') : '',
  title: process.env.APP_NAME || 'Stacks',
  width: 1400,
  height: 900,
  darkMode: false,
  systemTray: true,
  hideDockIcon: false,
  releaseChannel,
  platform: process.platform,
  architecture: process.arch,
  // Read by `build:dmg`, which cannot otherwise tell a bundle that talks to a
  // remote origin from one that only ever talks to itself — and the two want
  // very different App Transport Security.
  launcher: ownsLauncher ? 'userland' : 'framework',
}, null, 2)}\n`)

const gitResult = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: projectPath() })
if (gitResult.exitCode !== 0) throw new Error('Desktop builds require an exact Git source revision')
const sourceRevision = gitResult.stdout.toString().trim()

// Provenance must name the repository that was actually built. Hardcoding the
// Stacks repo made every consumer app's build claim it came from Stacks.
const remoteResult = Bun.spawnSync(['git', 'remote', 'get-url', 'origin'], { cwd: projectPath() })
const sourceRepository = remoteResult.exitCode === 0
  ? remoteResult.stdout.toString().trim().replace(/\.git$/, '')
  : 'unknown'
const artifacts = [launcherName, runtimeName, 'desktop.json'].map((name) => {
  const contents = readFileSync(join(outputDir, name))
  return { name, bytes: contents.byteLength, sha256: createHash('sha256').update(contents).digest('hex') }
})
writeFileSync(join(outputDir, 'provenance.json'), `${JSON.stringify({
  schemaVersion: '1.0.0',
  sourceRepository,
  sourceRevision,
  builtWith: { bun: Bun.version, craftSha256: artifacts.find(artifact => artifact.name === runtimeName)?.sha256 },
  target: { platform: process.platform, architecture: process.arch, status: support.status, osVersions: support.osVersions },
  releaseChannel,
  artifacts,
}, null, 2)}\n`)
writeFileSync(join(outputDir, 'checksums.sha256'), `${artifacts.map(artifact => `${artifact.sha256}  ${artifact.name}`).join('\n')}\n`)

log.success(`Built Craft desktop application in ${outputDir}`)
if (ownsLauncher)
  log.info(`Using this application's own launcher (${launcherEntry}).`)
