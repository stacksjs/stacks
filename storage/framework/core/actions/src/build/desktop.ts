import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { corePath, projectPath, storagePath } from '@stacksjs/path'
import { assertDesktopReleaseChannel, resolveCraftBinary } from '@stacksjs/desktop'

const outputDir = storagePath('framework/desktop-dist')
const launcherName = process.platform === 'win32' ? 'stacks-desktop.exe' : 'stacks-desktop'
const runtimeName = process.platform === 'win32' ? 'craft-runtime.exe' : 'craft-runtime'
const appUrl = process.env.DESKTOP_URL || process.env.APP_URL
const releaseChannel = process.env.DESKTOP_RELEASE_CHANNEL === 'stable' ? 'stable' : 'experimental'
const support = assertDesktopReleaseChannel(releaseChannel)

if (!appUrl)
  throw new Error('Desktop builds require APP_URL or DESKTOP_URL so the native app knows which Stacks application to open')

const url = new URL(/^https?:\/\//.test(appUrl) ? appUrl : `https://${appUrl}`)
const craftBinary = resolveCraftBinary()
if (basename(craftBinary) === 'craft' && !existsSync(craftBinary))
  throw new Error('Build Craft first in ~/Code/Tools/craft, or set CRAFT_BIN to the native Craft binary')

if (existsSync(outputDir))
  rmSync(outputDir, { recursive: true })
mkdirSync(outputDir, { recursive: true })

await runCommand('bun run build', { cwd: corePath('desktop') })
await runCommand(`bun build --compile ${JSON.stringify(corePath('desktop/src/launcher.ts'))} --outfile ${JSON.stringify(join(outputDir, launcherName))}`, {
  cwd: projectPath(),
})

copyFileSync(craftBinary, join(outputDir, runtimeName))
if (process.platform !== 'win32') {
  chmodSync(join(outputDir, launcherName), 0o755)
  chmodSync(join(outputDir, runtimeName), 0o755)
}

writeFileSync(join(outputDir, 'desktop.json'), `${JSON.stringify({
  url: url.toString().replace(/\/$/, ''),
  title: process.env.APP_NAME || 'Stacks',
  width: 1400,
  height: 900,
  darkMode: false,
  systemTray: true,
  hideDockIcon: false,
  releaseChannel,
  platform: process.platform,
  architecture: process.arch,
}, null, 2)}\n`)

const gitResult = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: projectPath() })
if (gitResult.exitCode !== 0) throw new Error('Desktop builds require an exact Git source revision')
const sourceRevision = gitResult.stdout.toString().trim()
const artifacts = [launcherName, runtimeName, 'desktop.json'].map((name) => {
  const contents = readFileSync(join(outputDir, name))
  return { name, bytes: contents.byteLength, sha256: createHash('sha256').update(contents).digest('hex') }
})
writeFileSync(join(outputDir, 'provenance.json'), `${JSON.stringify({
  schemaVersion: '1.0.0',
  sourceRepository: 'https://github.com/stacksjs/stacks',
  sourceRevision,
  builtWith: { bun: Bun.version, craftSha256: artifacts.find(artifact => artifact.name === runtimeName)?.sha256 },
  target: { platform: process.platform, architecture: process.arch, status: support.status, osVersions: support.osVersions },
  releaseChannel,
  artifacts,
}, null, 2)}\n`)
writeFileSync(join(outputDir, 'checksums.sha256'), `${artifacts.map(artifact => `${artifact.sha256}  ${artifact.name}`).join('\n')}\n`)

log.success(`Built Craft desktop application in ${outputDir}`)
