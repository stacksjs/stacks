import type { DesktopTargetName } from '@stacksjs/types'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import {
  assembleWebviewMacosApp,
  collectViewFiles,
  findDevelopmentIdentity,
  hostDesktopTarget,
  loadWebviewDesktop,
  nativeBuildSteps,
  parseDesktopTargets,
  probeCraftFlags,
  renderWebviewEntry,
  signtoolArgs,
  resolveCraftExecutable,
  splitDesktopTarget,
  validateWebviewDesktop,
  webviewAgentEntry,
  webviewCompileArgs,
  webviewManifest,
  webviewPackageConfig,
  webviewRuntimeFor,
} from '@stacksjs/desktop-build'
import { projectPath } from '@stacksjs/path'

/**
 * `buddy build:desktop` for a project whose `config/desktop.ts` declares a
 * `webview` app: a compiled agent with the built views inside it, bundled with
 * Craft's web view binary, for each target asked for.
 *
 * `STACKS_DESKTOP_LAUNCH=1` (`buddy dev:desktop`) builds nothing: it runs the
 * launcher from source in the project, with the views rendered live by stx.
 *
 * What a target's build makes here:
 * - darwin: `<App>.app`, signed (ad hoc unless an identity is given). macOS only.
 * - win32: the files an MSI is made from and `craft-package.json`, the input
 *   to Craft's packaging. The MSI itself needs WiX, so Windows.
 * - linux: one binary with Craft inside it and `craft-package.json`. The
 *   AppImage, deb and rpm need their Linux tools.
 * `DESKTOP_PACKAGE=1` (`--package`) runs Craft's packaging for the targets
 * this machine's operating system can make.
 */
process.exitCode = 1

const root = projectPath()
const pkg = existsSync(join(root, 'package.json')) ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: string } : {}
const config = await loadWebviewDesktop(root, pkg.version)
if (!config) throw new Error('config/desktop.ts has no webview section.')
const problems = validateWebviewDesktop(config)
if (problems.length) throw new Error(`config/desktop.ts cannot build:\n${problems.map(problem => `  - ${problem}`).join('\n')}`)

const host = hostDesktopTarget()
const output = resolve(root, config.output)
const work = join(output, '.build')
mkdirSync(work, { recursive: true })
const agentEntry = webviewAgentEntry(root, config.agent.entry)
const viewsDir = resolve(root, config.agent.views)
const hostRuntime = (): string => resolveCraftExecutable()

if (process.env.STACKS_DESKTOP_LAUNCH === '1') {
  const entry = join(work, 'dev-entry.ts')
  const devRuntime = webviewRuntimeFor(config, host, { root, hostRuntime })
  writeFileSync(entry, renderWebviewEntry({
    manifest: webviewManifest(config, { runtime: devRuntime, runtimeFlags: probeCraftFlags(devRuntime), development: true }),
    agentEntry,
    ...(existsSync(viewsDir) ? { stxViews: { dir: viewsDir, root, ...(config.agent.components?.length ? { components: config.agent.components.map(directory => resolve(root, directory)) } : {}) } } : {}),
  }))
  await log.info(`Starting ${config.appName} (Ctrl-C quits)`)
  const child = Bun.spawn(['bun', entry, ...process.argv.slice(2).filter(arg => !arg.startsWith('-'))], { cwd: root, stdio: ['inherit', 'inherit', 'inherit'] })
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal))
  process.exitCode = await child.exited
  process.exit()
}

const targets = parseDesktopTargets(process.env.DESKTOP_TARGETS, host)
const revision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root, stdout: 'pipe', stderr: 'ignore' })
const sourceRevision = revision.exitCode === 0 ? revision.stdout.toString().trim() : undefined

function run(command: string[], describe: string): void {
  const result = Bun.spawnSync(command, { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(`${describe} failed:\n${result.stderr.toString().trim() || result.stdout.toString().trim()}`)
}

// The views, built once and compiled into every target's agent.
const builtViews = join(work, 'views')
if (existsSync(viewsDir)) {
  rmSync(builtViews, { recursive: true, force: true })
  const own = join(root, 'app/Desktop/build-views.ts')
  if (existsSync(own)) {
    // The project builds its own views; it is told where to put them.
    const built = Bun.spawnSync(['bun', own], { cwd: root, env: { ...process.env, DESKTOP_VIEWS_OUT: builtViews }, stdio: ['ignore', 'inherit', 'inherit'] })
    if (built.exitCode !== 0) throw new Error('app/Desktop/build-views.ts failed')
  }
  else {
    const script = join(work, 'build-views.ts')
    writeFileSync(script, `// Written by buddy build:desktop. Do not edit.
import { buildStaticSite } from '@stacksjs/stx'

await buildStaticSite({
  name: ${JSON.stringify(config.appName)},
  url: 'http://127.0.0.1',
  pagesDir: ${JSON.stringify(relative(root, viewsDir))},
  outDir: ${JSON.stringify(builtViews)},
  publicDir: ${JSON.stringify(join(relative(root, viewsDir), 'public'))},
  sitemap: false,
  robots: false,
})
`)
    const built = Bun.spawnSync(['bun', script], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] })
    if (built.exitCode !== 0) throw new Error(`Building the views in ${config.agent.views} failed`)
  }
}
const viewFiles = collectViewFiles(builtViews)
if (!viewFiles['/index.html'] && !agentEntry)
  throw new Error(`Nothing for the window to open: ${config.agent.views} has no index.stx, and there is no agent module to answer /.`)
await log.info(`Built ${Object.keys(viewFiles).length} view file(s) from ${config.agent.views}`)

interface BuiltTarget {
  target: DesktopTargetName
  directory: string
  /** What this build made for the target, relative to `directory`. */
  artifacts: string[]
  /** What is still to do, and where. */
  remaining?: string
}
const built: BuiltTarget[] = []

for (const target of targets) {
  const { platform } = splitDesktopTarget(target)
  const directory = join(output, target)
  rmSync(directory, { recursive: true, force: true })
  mkdirSync(directory, { recursive: true })
  const runtime = webviewRuntimeFor(config, target, { root, hostRuntime })
  // Copied verbatim into the app, so it has to be the native binary: a dev wrapper script points outside the bundle.
  if (readFileSync(runtime).subarray(0, 2).toString() === '#!') throw new Error(`The Craft runtime for ${target} is a script, not a native binary: ${runtime}`)

  const embedded = platform === 'linux'
  const entry = join(work, `entry-${target}.ts`)
  writeFileSync(entry, renderWebviewEntry({
    manifest: webviewManifest(config, { runtime: embedded ? 'embedded' : 'beside', runtimeFlags: probeCraftFlags(runtime), sourceRevision }),
    agentEntry,
    viewFiles,
    ...(embedded ? { embeddedRuntime: runtime } : {}),
  }))
  const agent = join(work, platform === 'win32' ? `agent-${target}.exe` : `agent-${target}`)
  await log.info(`Compiling the agent for ${target}${target === host ? '' : ' (cross-compiled by Bun)'}`)
  run(['bun', ...webviewCompileArgs({ entry, outfile: agent, target, host, minify: process.env.DESKTOP_MINIFY !== 'false' })], `Compiling the agent for ${target}`)

  if (platform === 'darwin') {
    if (process.platform !== 'darwin') {
      copyFileSync(agent, join(directory, config.executable))
      copyFileSync(runtime, join(directory, 'craft-runtime'))
      built.push({ target, directory, artifacts: [config.executable, 'craft-runtime'], remaining: nativeBuildSteps(target) })
      continue
    }
    // A stable certificate keeps Keychain items trusted across rebuilds; ad hoc runs on this Mac only.
    const identity = process.env.DESKTOP_SIGNING_IDENTITY || findDevelopmentIdentity() || '-'
    const assembled = assembleWebviewMacosApp({ config, root, agent, runtime, output: directory, signingIdentity: identity })
    for (const key of assembled.ignoredPlistKeys) await log.warn(`webview.macos.infoPlist: ${key} is set by the build and was ignored`)
    built.push({ target, directory, artifacts: [basename(assembled.appPath)], ...(identity === '-' ? { remaining: 'Signed ad hoc: it runs on this Mac only. `buddy release:desktop` signs with a Developer ID and notarizes.' } : {}) })
    continue
  }

  const packages = join(directory, 'packages')
  const icon = config.icon ? resolve(root, config.icon) : undefined
  let packageConfig: Record<string, unknown>
  const artifacts: string[] = []
  if (platform === 'win32') {
    const binary = join(directory, `${config.executable}.exe`)
    copyFileSync(agent, binary)
    const companions = [join(directory, 'craft-runtime.exe')]
    copyFileSync(runtime, companions[0]!)
    for (const file of config.windows?.additionalFiles ?? []) {
      const from = resolve(root, file)
      if (!existsSync(from)) throw new Error(`webview.windows.additionalFiles: ${from} does not exist`)
      companions.push(join(directory, basename(from)))
      copyFileSync(from, companions.at(-1)!)
    }
    artifacts.push(basename(binary), ...companions.map(file => basename(file)))
    packageConfig = webviewPackageConfig(config, target, { binary, additionalFiles: companions, outDir: packages, icon })
  }
  else {
    const binary = join(directory, config.slug)
    copyFileSync(agent, binary)
    chmodSync(binary, 0o755)
    artifacts.push(basename(binary))
    packageConfig = webviewPackageConfig(config, target, { binary, outDir: packages, icon })
  }
  // Written with paths relative to itself, so the folder can be carried to the machine that packages it.
  if (icon) copyFileSync(icon, join(directory, basename(icon)))
  writeFileSync(join(directory, 'craft-package.json'), `${JSON.stringify(packageConfig, (_key, value: unknown) => typeof value === 'string' && value.startsWith(`${directory}/`) ? `./${relative(directory, value)}` : value === icon && icon ? `./${basename(icon)}` : value, 2)}\n`)
  artifacts.push('craft-package.json')

  const canPackage = process.platform === platform
  if (process.env.DESKTOP_PACKAGE === '1' && canPackage) {
    const { packageApp } = await import('craft-native')
    const windows = packageConfig.windows as Record<string, unknown> | undefined
    if (typeof windows?.certificatePath === 'string') {
      // The certificate's password is read here and never written to craft-package.json.
      const certificatePassword = process.env.DESKTOP_WINDOWS_CERTIFICATE_PASSWORD
      if (certificatePassword) windows.certificatePassword = certificatePassword
      // Craft signs the MSI it makes; the executables inside it are signed here first, so what is installed is signed too.
      for (const name of artifacts.filter(file => file.endsWith('.exe')))
        run(signtoolArgs({ file: join(directory, name), certificatePath: resolve(root, windows.certificatePath), certificatePassword }), `Signing ${name}`)
    }
    for (const result of await packageApp(packageConfig as unknown as Parameters<typeof packageApp>[0])) {
      if (!result.success) throw new Error(`Packaging ${result.format} for ${target} failed: ${result.error}`)
      if (result.outputPath) artifacts.push(relative(directory, result.outputPath))
    }
    built.push({ target, directory, artifacts })
  }
  else {
    built.push({ target, directory, artifacts, remaining: canPackage ? 'Pass --package to make the installers from craft-package.json.' : nativeBuildSteps(target) })
  }
}

writeFileSync(join(output, 'build.json'), `${JSON.stringify({
  appName: config.appName,
  appId: config.appId,
  version: config.version,
  sourceRevision: sourceRevision ?? null,
  builtOn: host,
  bun: Bun.version,
  targets: built.map(item => ({
    target: item.target,
    directory: relative(output, item.directory),
    artifacts: item.artifacts.map((name) => {
      const file = join(item.directory, name)
      return name.endsWith('.app') ? { name } : { name, bytes: readFileSync(file).byteLength, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }
    }),
    ...(item.remaining ? { remaining: item.remaining } : {}),
  })),
}, null, 2)}\n`)

for (const item of built) {
  await log.success(`${item.target}: ${item.artifacts.map(name => join(relative(root, item.directory), name)).join(', ')}`)
  if (item.remaining) await log.info(`  ${item.remaining}`)
}

if (process.env.STACKS_DESKTOP_OPEN === '1') {
  const mine = built.find(item => item.target === host)
  const app = mine?.artifacts.find(name => name.endsWith('.app'))
  if (mine && app) Bun.spawn(['open', '-n', join(mine.directory, app)], { stdout: 'inherit', stderr: 'inherit' })
}
process.exitCode = 0
