import type { DesktopAgentManifest, MacosAgentBundle, MacosDistribution, ResolvedMacosDesktop } from '@stacksjs/desktop-build'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { log } from '@stacksjs/cli'
import { AGENT_MANIFEST, agentHostArguments, desktopLauncherCompileArgs, macosOutputDirectory, macosScreens, renderAgentEntry, validateMacosDesktop } from '@stacksjs/desktop-build'
import { projectPath, storagePath } from '@stacksjs/path'
import { craftBuilderVersion } from './craft-entry'

/**
 * What a native macOS app needs before it can be a bundle: its stx screens
 * compiled to the script Craft's AppKit host runs, and the host itself. Shared
 * by `buddy build:desktop` (a development app) and `buddy desktop:apple:package`
 * (the sandboxed Mac App Store app), so the two cannot drift.
 *
 * Nothing here is project-specific. The Zig compiler and the zig-js engine the
 * host is built with come from Craft's `resolveMacOSToolchain` (Pantry installs
 * the pinned compiler), so an app carries no toolchain lock file of its own.
 */

interface CraftMacosBuilder {
  buildMacOSNative: (options: { outdir: string, nativeBundle: string, webkit?: boolean }) => Promise<{ executable: string, bundle: string }>
}

/** The file an entry URL names: the Craft source in a checkout, or the published `dist` module. */
function entryFile(entry: string, root: string): string | null {
  try {
    return entry.startsWith('file:') ? new URL(entry).pathname : Bun.resolveSync(entry, root)
  }
  catch {
    return null
  }
}

/**
 * Whether this Craft's `buildMacOSNative` takes `webkit`. Read from its source
 * rather than assumed from a version: the option lands in a checkout before it
 * lands in a release, and a Craft that does not know it would build a host
 * without WebKit and say nothing, leaving every `<WebView>` blank.
 */
export function craftSupportsWebkit(source: string): boolean {
  // `options.webkit` (or `e.webkit` once minified), or `{ webkit }` destructured.
  return /\.webkit\b|[{,]\s*webkit\s*[,}=]/.test(source)
}

type CompileNativeBundle = (options: {
  screens: Record<string, string>
  initialScreen?: string
  minify?: boolean
  outFile?: string
  root?: string
  app?: string
  shareStorage?: Record<string, string>
}) => Promise<{ outFile?: string, diagnostics?: Array<{ level?: string, message: string, file?: string }> }>

/** `CRAFT_MACOS_SRC` (a Craft checkout's packages/macos/src/index.ts) or the copy of craft-native the desktop package resolves. */
function craftMacosEntry(root: string): string {
  if (process.env.CRAFT_MACOS_SRC) return pathToFileURL(process.env.CRAFT_MACOS_SRC).href
  try {
    const desktop = Bun.resolveSync('@stacksjs/desktop-build/package.json', root)
    return pathToFileURL(Bun.resolveSync('craft-native/macos', dirname(desktop))).href
  }
  catch {
    return 'craft-native/macos'
  }
}

/** What the host binary depends on, so a rebuilt screen reuses it and a new Craft does not. */
function hostKey(entry: string, root: string, webkit = false): string {
  const hash = createHash('sha256')
  // A host with WebKit linked is a different binary from one without.
  if (webkit) hash.update('webkit')
  const path = entry.startsWith('file:') ? new URL(entry).pathname : entry
  const version = craftBuilderVersion(entry, root)?.version
  hash.update(version ?? 'unversioned')
  if (process.env.CRAFT_MACOS_SRC || !version) {
    const templates = join(dirname(path), '../templates')
    if (existsSync(templates)) for (const file of readdirSync(templates).sort()) hash.update(readFileSync(join(templates, file)))
  }
  return hash.digest('hex').slice(0, 16)
}

export interface PreparedMacosNative {
  root: string
  /** Where the app goes. */
  output: string
  /** The compiled screens. */
  nativeBundle: string
  /** Craft's AppKit host executable. */
  host: string
  /** What the host was built from, for provenance. */
  hostKey: string
}

export async function prepareMacosNative(config: ResolvedMacosDesktop, options: { root?: string } = {}): Promise<PreparedMacosNative> {
  const root = options.root ?? projectPath()
  const errors = validateMacosDesktop(config)
  if (errors.length) throw new Error(`config/desktop.ts macos is not buildable:\n${errors.map(error => `  - ${error}`).join('\n')}`)
  if (process.platform !== 'darwin') throw new Error('The native macOS app builds on macOS')

  const output = macosOutputDirectory(root, config)
  const work = join(output, '.build')
  mkdirSync(work, { recursive: true })

  // 1. The screens: stx compiled to the script Craft's AppKit host runs.
  const screens = Object.fromEntries(Object.entries(macosScreens(config)).map(([name, file]) => [name, join(root, file)]))
  for (const [name, file] of Object.entries(screens)) if (!existsSync(file)) throw new Error(`macos.nativeScreens: screen "${name}" is ${file}, which does not exist`)
  // `STX_NATIVE_SRC` (an stx checkout's packages/stx/src/native/index.ts) is the development override, as `CRAFT_MACOS_SRC` is for Craft.
  const { compileNativeBundle } = await import(process.env.STX_NATIVE_SRC ? pathToFileURL(process.env.STX_NATIVE_SRC).href : '@stacksjs/stx/native') as { compileNativeBundle: CompileNativeBundle }
  const app = config.nativeApp ? join(root, config.nativeApp) : undefined
  const compiled = await compileNativeBundle({
    screens,
    initialScreen: config.initialScreen,
    minify: true,
    outFile: join(work, 'native-screen.js'),
    root,
    ...(app ? { app } : {}),
    ...(config.shareStorage && Object.keys(config.shareStorage).length ? { shareStorage: { ...config.shareStorage } } : {}),
  })
  // A <script> in a native screen is run by the host, not drawn: stx notes it as dropped from the view tree.
  const problems = (compiled.diagnostics ?? []).filter(item => item.message !== 'dropped-subtree: script')
  for (const item of problems) await log.warn(`${item.file ? `${item.file}: ` : ''}${item.message}`)
  if (problems.some(item => item.level === 'error')) throw new Error('The native screens did not compile')
  const nativeBundle = compiled.outFile ?? join(work, 'native-screen.js')

  // 2. The host: Craft's AppKit renderer, built once per Craft revision.
  const entry = craftMacosEntry(root)
  const webkit = config.webkit === true
  if (webkit) {
    const file = entryFile(entry, root)
    if (!file || !existsSync(file) || !craftSupportsWebkit(readFileSync(file, 'utf8')))
      throw new Error(`macos.webkit needs a Craft whose buildMacOSNative links WebKit, and ${file ?? entry} does not. Upgrade craft-native, or point CRAFT_MACOS_SRC at a Craft checkout that has it.`)
  }
  const key = hostKey(entry, root, webkit)
  const hostDirectory = storagePath(`framework/desktop/host/${key}`)
  const host = join(hostDirectory, 'craft-native-macos')
  if (!existsSync(host)) {
    await log.info(`Building the AppKit host${webkit ? ' with WebKit' : ''} (first build for this Craft; the toolchain installs through Pantry)`)
    const builder = await import(entry) as CraftMacosBuilder
    mkdirSync(hostDirectory, { recursive: true })
    await builder.buildMacOSNative({ outdir: hostDirectory, nativeBundle, ...(webkit ? { webkit: true } : {}) })
  }

  return { root, output, nativeBundle, host, hostKey: key }
}

/** Where the agent's own routes are: `macos.agent.entry`, else `app/Desktop/Agent.ts` when the project has one. */
export function macosAgentEntry(root: string, config: Pick<ResolvedMacosDesktop, 'agent'>): string | undefined {
  if (!config.agent) return undefined
  if (config.agent.entry) {
    const entry = resolve(root, config.agent.entry)
    if (!existsSync(entry)) throw new Error(`macos.agent.entry does not exist: ${entry}`)
    return entry
  }
  const conventional = join(root, 'app/Desktop/Agent.ts')
  return existsSync(conventional) ? conventional : undefined
}

/**
 * The manifest the agent launcher reads, for a run from the project
 * (`buddy dev:desktop`): absolute paths to the host and screens just built,
 * and the project's route registry loaded unless the config says otherwise.
 */
export function macosAgentDevManifest(config: ResolvedMacosDesktop, prepared: Pick<PreparedMacosNative, 'host' | 'nativeBundle' | 'root'>): DesktopAgentManifest {
  return {
    appName: config.appName,
    bundleId: config.bundleId,
    version: config.version,
    host: prepared.host,
    nativeBundle: prepared.nativeBundle,
    hostArguments: agentHostArguments(config),
    ...(config.agent?.port ? { port: config.agent.port } : {}),
    ...(config.agent?.staticDir ? { staticDir: resolve(prepared.root, config.agent.staticDir) } : {}),
    projectRoot: prepared.root,
    appRoutes: config.agent?.appRoutes !== false,
  }
}

/**
 * The project's route files, as `app/Routes.ts` names and mounts them (the
 * same rules as the router's `loadRoutes`): the key is the prefix unless the
 * entry sets one, `web` and `prefix: ''` mount at the root.
 */
export async function macosAgentRouteFiles(root: string): Promise<Array<{ file: string, prefix?: string, middleware?: string[] }>> {
  const manifest = join(root, 'app/Routes.ts')
  const loaded = existsSync(manifest) ? (await import(pathToFileURL(manifest).href) as { default?: Record<string, string | { path: string, prefix?: string, middleware?: string | string[] }> }).default : undefined
  const registry = loaded && typeof loaded === 'object' && Object.keys(loaded).length ? loaded : { api: 'api' }
  const files: Array<{ file: string, prefix?: string, middleware?: string[] }> = []
  for (const [key, definition] of Object.entries(registry)) {
    const config = typeof definition === 'string' ? { path: definition } : definition
    const file = ['.ts', '.js'].map(extension => join(root, 'routes', `${config.path}${extension}`)).find(candidate => existsSync(candidate))
    if (!file) continue
    const prefix = config.prefix !== undefined ? (config.prefix ? (config.prefix.startsWith('/') ? config.prefix : `/${config.prefix}`) : undefined) : (key === 'web' ? undefined : `/${key}`)
    const middleware = config.middleware === undefined ? [] : Array.isArray(config.middleware) ? config.middleware : [config.middleware]
    files.push({ file, ...(prefix ? { prefix } : {}), ...(middleware.length ? { middleware } : {}) })
  }
  return files
}

/**
 * The actions the given source files name by string (`'Actions/SaveTab'`),
 * resolved the way the router resolves them: the app's `app/Actions` first,
 * then the framework defaults. A name that resolves nowhere is left out; the
 * router reports it on the request that uses it, as it would in development.
 */
export function macosAgentActionFiles(root: string, sources: string[]): Record<string, string> {
  const actions: Record<string, string> = {}
  for (const source of sources) {
    if (!existsSync(source)) continue
    for (const match of readFileSync(source, 'utf8').matchAll(/['"`](Actions\/[\w/-]+?)(?:\.ts)?['"`]/g)) {
      const name = match[1]!
      if (actions[name]) continue
      const file = [join(root, 'app', `${name}.ts`), join(root, 'storage/framework/defaults/app', `${name}.ts`)].find(candidate => existsSync(candidate))
      if (file) actions[name] = file
    }
  }
  return actions
}

/**
 * The agent launcher, written and compiled for the bundle. A compiled binary
 * cannot read route files off disk (the router refuses: they could not
 * resolve the framework packages from there), so the project's route files
 * are imported statically and travel inside the launcher, the same in a
 * development build and a Mac App Store one. So are the actions those files
 * name by string, which the router would otherwise import off disk too.
 */
export async function prepareMacosAgent(config: ResolvedMacosDesktop, prepared: PreparedMacosNative, _distribution: MacosDistribution): Promise<MacosAgentBundle> {
  if (!config.agent) throw new Error('config/desktop.ts has no macos.agent')
  const work = join(prepared.output, '.build')
  const entry = join(work, 'agent-entry.ts')
  const routes = config.agent.appRoutes === false ? [] : await macosAgentRouteFiles(prepared.root)
  const agentEntry = macosAgentEntry(prepared.root, config)
  const actions = macosAgentActionFiles(prepared.root, [...routes.map(route => route.file), ...(agentEntry ? [agentEntry] : [])])
  writeFileSync(entry, renderAgentEntry({ agentEntry, routes, actions }))
  const launcher = join(work, `${config.executable}-agent`)
  const compile = Bun.spawnSync(['bun', ...desktopLauncherCompileArgs({ entry, outfile: launcher })], { cwd: prepared.root, stdout: 'pipe', stderr: 'pipe' })
  if (compile.exitCode !== 0)
    throw new Error(`Compiling the agent launcher failed:\n${compile.stderr.toString().trim() || compile.stdout.toString().trim()}`)
  return {
    launcher,
    manifest: {
      appName: config.appName,
      bundleId: config.bundleId,
      version: config.version,
      hostArguments: agentHostArguments(config),
      ...(config.agent.port ? { port: config.agent.port } : {}),
      ...(config.agent.staticDir ? { staticDir: resolve(prepared.root, config.agent.staticDir) } : {}),
      appRoutes: false,
    },
  }
}

/** Where `buddy dev:desktop` writes the manifest it runs the launcher from source with. */
export function macosAgentDevFiles(prepared: Pick<PreparedMacosNative, 'output'>): { entry: string, manifest: string } {
  const work = join(prepared.output, '.build')
  return { entry: join(work, 'agent-entry.ts'), manifest: join(work, AGENT_MANIFEST) }
}
