import type { WebviewBuildRecord } from '@stacksjs/desktop-build'
import type { DesktopTargetName } from '@stacksjs/types'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import {
  assembleWebviewMacosApp,
  collectViewFiles,
  craftRuntimeAsset,
  configuredWebviewRuntime,
  describeBuildArtifact,
  fetchCraftRuntime,
  findDevelopmentIdentity,
  hostDesktopTarget,
  importWebviewBuild,
  installedCraftVersion,
  loadWebviewDesktop,
  mergeBuildRecord,
  nativeBuildSteps,
  parseDesktopTargets,
  probeCraftFlags,
  recordPackagedInstallers,
  renderViewsBuildScript,
  renderWebviewEntry,
  resolveCraftExecutable,
  resolveWebviewComponents,
  signingIdentityNote,
  signtoolArgs,
  splitDesktopTarget,
  validateWebviewDesktop,
  webviewAgentEntry,
  webviewCompileArgs,
  webviewManifest,
  webviewPackageConfig,
  webviewRuntimeFor,
  windowsRuntimeCompanions,
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

/**
 * A target's Craft runtime: the one the config or the environment names, this
 * machine's own Craft for this machine's target, else the one Craft published
 * for the installed craft-native version, fetched once and kept under
 * storage/framework/desktop/runtimes. A machine with no Craft of its own (a CI
 * runner) fetches its own target's the same way. DESKTOP_RUNTIME_FETCH=0 keeps
 * a build off the network.
 */
async function runtimeFor(target: DesktopTargetName): Promise<string> {
  const named = configuredWebviewRuntime(config!, target, { root })
  if (named) return named
  let missing: unknown
  if (target === host) {
    try {
      return hostRuntime()
    }
    catch (error) {
      // No Craft installed here: the published one for this platform does the same job.
      missing = error
    }
  }
  const version = installedCraftVersion(root)
  if (process.env.DESKTOP_RUNTIME_FETCH === '0' || !version || !craftRuntimeAsset(target)) {
    if (missing) throw missing
    // Says what to configure when there is nothing to fetch, or nothing to fetch with.
    return webviewRuntimeFor(config!, target, { root, hostRuntime })
  }
  const fetched = await fetchCraftRuntime({
    target,
    version,
    directory: join(root, 'storage/framework/desktop/runtimes', target),
    onFetch: (url) => { void log.info(`Fetching ${url}`) },
  })
  if (fetched.fetched) await log.info(`Craft ${fetched.version} runtime for ${target}: ${relative(root, fetched.binary)}`)
  return fetched.binary
}

if (process.env.STACKS_DESKTOP_LAUNCH === '1') {
  const entry = join(work, 'dev-entry.ts')
  const devRuntime = await runtimeFor(host)
  writeFileSync(entry, renderWebviewEntry({
    manifest: webviewManifest(config, { runtime: devRuntime, runtimeFlags: probeCraftFlags(devRuntime), development: true }),
    agentEntry,
    ...(existsSync(viewsDir) ? { stxViews: { dir: viewsDir, root, ...(config.agent.components?.length ? { components: resolveWebviewComponents(root, config.agent.components) } : {}) } } : {}),
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

/**
 * Make a staged target's installers with Craft, from the craft-package.json
 * beside it. Returns what it made, relative to the target's folder.
 */
async function packageStaged(target: DesktopTargetName, directory: string, packageConfig: Record<string, unknown>, executables: string[]): Promise<string[]> {
  const { packageApp } = await import('craft-native')
  const windows = packageConfig.windows as Record<string, unknown> | undefined
  if (typeof windows?.certificatePath === 'string') {
    // The certificate's password is read here and never written to craft-package.json.
    const certificatePassword = process.env.DESKTOP_WINDOWS_CERTIFICATE_PASSWORD
    if (certificatePassword) windows.certificatePassword = certificatePassword
    // Craft signs the MSI it makes; the executables inside it are signed here first, so what is installed is signed too.
    for (const name of executables)
      run(signtoolArgs({ file: join(directory, name), certificatePath: resolve(root, windows.certificatePath), certificatePassword }), `Signing ${name}`)
  }
  const made: string[] = []
  for (const result of await packageApp(packageConfig as unknown as Parameters<typeof packageApp>[0])) {
    if (!result.success) throw new Error(`Packaging ${result.format} for ${target} failed: ${result.error}`)
    if (result.outputPath) made.push(relative(directory, result.outputPath))
  }
  return made
}

// `--import <folder>`: targets built on another machine join this project's build record, so a release can publish
// them. Nothing is built. With --package, a target for this operating system that came without installers gets them
// made here (an MSI on Windows, from a folder cross-compiled elsewhere).
if (process.env.DESKTOP_IMPORT) {
  if (!sourceRevision) throw new Error('An import is checked against the commit this checkout is at, and this is not a Git checkout.')
  const result = importWebviewBuild({
    from: resolve(root, process.env.DESKTOP_IMPORT),
    output,
    appId: config.appId,
    version: config.version,
    sourceRevision,
    host,
    ...(process.env.DESKTOP_TARGETS ? { targets } : {}),
  })
  for (const target of result.skipped) await log.info(`${target} is in that build record, but its folder was not brought along: left out.`)
  for (const target of result.dropped) await log.warn(`${target} was in the build record from another version or commit, and is no longer.`)
  for (const item of result.imported) {
    const { platform } = splitDesktopTarget(item.target)
    const packageFile = join(item.directory, 'craft-package.json')
    const entry = result.record.targets.find(candidate => candidate.target === item.target)!
    const hasInstaller = entry.artifacts.some(artifact => artifact.name.startsWith('packages/'))
    if (process.env.DESKTOP_PACKAGE === '1' && process.platform === platform && platform !== 'darwin' && !hasInstaller && existsSync(packageFile)) {
      // Written with paths relative to itself, so it could be carried here.
      const packageConfig = JSON.parse(readFileSync(packageFile, 'utf8'), (_key, value: unknown) => typeof value === 'string' && value.startsWith('./') ? join(item.directory, value) : value) as Record<string, unknown>
      await packageStaged(item.target, item.directory, packageConfig, entry.artifacts.map(artifact => artifact.name).filter(name => name.endsWith('.exe')))
      recordPackagedInstallers(output, item.target)
    }
    const now = (JSON.parse(readFileSync(join(output, 'build.json'), 'utf8')) as typeof result.record).targets.find(candidate => candidate.target === item.target)!
    await log.success(`${item.target}: imported ${now.artifacts.map(artifact => artifact.name).join(', ')}`)
    for (const name of item.unrecorded) await log.warn(`  ${name} was not in the build record: recorded as found, with nothing to check it against.`)
  }
  process.exitCode = 0
  process.exit()
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
    writeFileSync(script, renderViewsBuildScript({ appName: config.appName, root, viewsDir, outDir: builtViews, components: config.agent.components }))
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
  const runtime = await runtimeFor(target)
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
    // Said now, not when notarization refuses it at the end of a release.
    const note = signingIdentityNote(identity, Boolean(process.env.DESKTOP_SIGNING_IDENTITY))
    built.push({ target, directory, artifacts: [basename(assembled.appPath)], ...(note ? { remaining: note } : {}) })
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
    // What the runtime needs beside it (WebView2Loader.dll), when it sits beside the runtime and the config does not name it.
    for (const from of windowsRuntimeCompanions(runtime, config.windows?.additionalFiles)) {
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
    artifacts.push(...await packageStaged(target, directory, packageConfig, artifacts.filter(file => file.endsWith('.exe'))))
    built.push({ target, directory, artifacts })
  }
  else {
    built.push({ target, directory, artifacts, remaining: canPackage ? 'Pass --package to make the installers from craft-package.json.' : nativeBuildSteps(target) })
  }
}

// Targets from an earlier run of the same version and commit stay in the record: a release is often built in several
// runs, and on several machines (`--import`).
const recordFile = join(output, 'build.json')
let earlier: WebviewBuildRecord | null = null
try {
  earlier = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, 'utf8')) as WebviewBuildRecord : null
}
catch {
  earlier = null
}
const { record } = mergeBuildRecord(
  earlier && Array.isArray(earlier.targets) ? earlier : null,
  { appName: config.appName, appId: config.appId, version: config.version, sourceRevision: sourceRevision ?? null, builtOn: host, bun: Bun.version },
  built.map(item => ({
    target: item.target,
    directory: relative(output, item.directory),
    artifacts: item.artifacts.map(name => describeBuildArtifact(item.directory, name)),
    ...(item.remaining ? { remaining: item.remaining } : {}),
  })),
)
writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`)

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
