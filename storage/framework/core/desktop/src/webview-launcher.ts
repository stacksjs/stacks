import type { BundledConfig } from '@stacksjs/config/sources'
import type { AgentBundleFiles, StacksAgentHandlerOptions } from './agent-launcher'
import type { BeforeDesktopInstall, BeforeDesktopUpdate, DesktopUpdater } from './update-install'
import type { SecondInstanceLaunch, WebviewAgent, WebviewAgentContext, WebviewHandler, WebviewViews } from './webview-agent'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { newAgentToken } from './agent'
import { agentBundleSource, logToFileWhenDetached, stacksAgentHandler } from './agent-launcher'
import { createDesktopUpdater, updateRequestHandler } from './update-install'
import { applyWidenedPath, desktopAppPaths, INSTANCE_HEADER, INSTANCE_PATH, startWebviewAgent } from './webview-agent'

/**
 * The executable of a web view desktop app (`desktop.webview`), on macOS,
 * Windows and Linux. It takes the instance lock, starts the agent, and opens
 * a Craft web view window on it; when the window closes, the app ends. A
 * second launch hands its arguments to the first and exits.
 *
 * `buddy dev:desktop` runs this from source in the project, with the views
 * rendered live by stx. `buddy build:desktop` compiles it, with the built
 * views and this manifest inside the executable.
 */

export interface WebviewAppManifest {
  appName: string
  appId: string
  version: string
  /**
   * The Craft web view binary: an absolute path (development), `beside` (next
   * to this executable as `craft-runtime`), or `embedded` (compiled into this
   * executable and unpacked to the data directory on first launch).
   */
  runtime: string
  window: {
    title: string
    width: number
    height: number
    darkMode?: boolean
    devtools?: boolean
    titlebarHidden?: boolean
    arguments?: string[]
  }
  port?: number
  startPath?: string
  publicPaths?: string[]
  urlSchemes?: string[]
  updates?: {
    feedUrl: string
    publicKeys: Record<string, string>
    channel?: string
    checkEveryHours?: number
  }
  /**
   * The optional Craft flags this app's runtime understands, found by the build
   * (`probeCraftFlags`). An older Craft given a flag it does not know opens the
   * wrong window, so only these are passed.
   */
  runtimeFlags?: string[]
  /** The commit the app was built from. */
  sourceRevision?: string
}

/** Craft flags the launcher uses when the runtime has them. */
export const OPTIONAL_CRAFT_FLAGS = ['--single-instance', '--deep-link', '--app-name'] as const

export const WEBVIEW_RUNTIME_NAME = 'craft-runtime'
/** Passed to a relaunched app: wait for this process (the one being replaced) to end before taking the lock. */
export const WAIT_PID_FLAG = '--wait-pid='

/** What an app's agent module (`app/Desktop/Agent.ts`) may export as its default. */
export interface WebviewAgentModule {
  /** Answers the window's requests; returning nothing lets the views answer. */
  fetch?: WebviewHandler
  /** Once, when the agent is serving and before the window opens. */
  start?: (context: WebviewAgentContext & { launch: SecondInstanceLaunch, updater?: DesktopUpdater }) => void | Promise<void>
  /** Another launch of the app: its arguments and, when a link started it, the URL. */
  secondInstance?: (launch: SecondInstanceLaunch) => void | Promise<void>
  /** When an update check finds a verified manifest: refuse it or require confirmation. */
  beforeUpdate?: BeforeDesktopUpdate
  /** Immediately before an app-managed install, for preparation such as a workspace backup. */
  beforeInstall?: BeforeDesktopInstall
  /** When the window has closed. */
  stop?: () => void | Promise<void>
}

/** A module's default export, as a `WebviewAgentModule`: a bare function is its `fetch`. */
export function agentModuleOf(loaded: unknown): WebviewAgentModule {
  const value = loaded && typeof loaded === 'object' && 'default' in loaded ? (loaded as { default: unknown }).default : loaded
  if (typeof value === 'function') return { fetch: value as WebviewHandler }
  return value && typeof value === 'object' ? value as WebviewAgentModule : {}
}

/** What the lock file holds: enough for a second launch to reach the first. */
export interface InstanceRecord {
  pid: number
  /** 0 until the agent is serving. */
  port: number
  secret: string
}

function readInstance(lockFile: string): InstanceRecord | null {
  try {
    const record = JSON.parse(readFileSync(lockFile, 'utf8')) as Partial<InstanceRecord>
    return Number.isInteger(record.pid) && typeof record.secret === 'string' ? { pid: record.pid!, port: Number(record.port) || 0, secret: record.secret } : null
  }
  catch {
    return null
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    // EPERM: alive, but someone else's process.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function writeInstance(lockFile: string, record: InstanceRecord): void {
  mkdirSync(dirname(lockFile), { recursive: true })
  // Written whole and renamed in, so a second launch never reads half a record. The secret is the owner's only.
  const temporary = `${lockFile}.${record.pid}`
  writeFileSync(temporary, JSON.stringify(record), { mode: 0o600 })
  renameSync(temporary, lockFile)
}

/**
 * Take the instance lock, or learn who holds it. A lock left by a process
 * that is gone is taken over.
 */
export function acquireWebviewInstance(lockFile: string, pid: number = process.pid): { acquired: true, record: InstanceRecord } | { acquired: false, holder: InstanceRecord } {
  const holder = readInstance(lockFile)
  if (holder && holder.pid !== pid && isAlive(holder.pid)) return { acquired: false, holder }
  const record = { pid, port: 0, secret: newAgentToken() }
  writeInstance(lockFile, record)
  return { acquired: true, record }
}

/** Record the port once the agent is serving, so a second launch can reach it. */
export function publishInstancePort(lockFile: string, record: InstanceRecord, port: number): void {
  record.port = port
  writeInstance(lockFile, record)
}

export function releaseWebviewInstance(lockFile: string, pid: number = process.pid): void {
  if (readInstance(lockFile)?.pid === pid) rmSync(lockFile, { force: true })
}

/**
 * A launch's arguments, sorted: the link that started it (an argument in one
 * of the app's URL schemes), the process to wait for after a relaunch, and
 * the rest, which are the app's own.
 */
export function parseLaunchArguments(argv: readonly string[], urlSchemes: readonly string[] = []): { args: string[], url?: string, waitPid?: number } {
  const args: string[] = []
  let url: string | undefined
  let waitPid: number | undefined
  for (const arg of argv) {
    if (arg.startsWith(WAIT_PID_FLAG)) {
      const pid = Number(arg.slice(WAIT_PID_FLAG.length))
      if (Number.isInteger(pid) && pid > 0) waitPid = pid
      continue
    }
    // macOS passes a process serial number to an app opened from Finder.
    if (arg.startsWith('-psn_')) continue
    if (!url && urlSchemes.some(scheme => arg.toLowerCase().startsWith(`${scheme.toLowerCase()}:`))) {
      url = arg
      continue
    }
    args.push(arg)
  }
  return { args, ...(url ? { url } : {}), ...(waitPid ? { waitPid } : {}) }
}

/**
 * Hand a launch to the instance that holds the lock. The holder may still be
 * starting (its port is 0 until it serves), so the lock is re-read for a few
 * seconds. Resolves false when it could not be reached.
 */
export async function forwardToInstance(lockFile: string, launch: SecondInstanceLaunch, options: { fetcher?: typeof fetch, attempts?: number, delayMs?: number } = {}): Promise<boolean> {
  const fetcher = options.fetcher ?? fetch
  for (let attempt = 0; attempt < (options.attempts ?? 40); attempt++) {
    const holder = readInstance(lockFile)
    if (!holder || !isAlive(holder.pid)) return false
    if (holder.port) {
      try {
        const response = await fetcher(`http://127.0.0.1:${holder.port}${INSTANCE_PATH}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', [INSTANCE_HEADER]: holder.secret },
          body: JSON.stringify(launch),
        })
        if (response.status === 204) return true
      }
      catch {}
    }
    await Bun.sleep(options.delayMs ?? 125)
  }
  return false
}

/**
 * Craft's command line for the app's window. `--single-instance` (where the
 * runtime has it) makes a second Craft with the same id forward to this one
 * and bring its window forward, which is how a second launch raises the app.
 */
export function craftWindowCommand(manifest: Pick<WebviewAppManifest, 'appName' | 'appId' | 'window' | 'runtimeFlags'>, runtime: string, url: string, launch: { args?: string[], url?: string } = {}): string[] {
  const { window } = manifest
  const has = (flag: string): boolean => manifest.runtimeFlags?.includes(flag) === true
  return [
    runtime,
    '--url',
    url,
    '--title',
    window.title,
    '--width',
    String(window.width),
    '--height',
    String(window.height),
    ...(has('--app-name') ? ['--app-name', manifest.appName] : []),
    ...(has('--single-instance')
      ? ['--single-instance', manifest.appId, ...(launch.args ?? []).flatMap(arg => ['--instance-arg', arg])]
      : []),
    ...(launch.url && has('--deep-link') ? ['--deep-link', launch.url] : []),
    ...(window.devtools ? [] : ['--no-devtools']),
    ...(window.darkMode === true ? ['--dark'] : window.darkMode === false ? ['--light'] : []),
    ...(window.titlebarHidden ? ['--titlebar-hidden'] : []),
    ...(window.arguments ?? []),
  ]
}

/**
 * Where the Craft binary is. An embedded one is unpacked to the data
 * directory, under its own digest, so an update that ships a new runtime
 * unpacks beside the old one and a tampered copy is replaced.
 */
export function resolveWebviewRuntime(manifest: Pick<WebviewAppManifest, 'runtime'>, options: { execPath?: string, embedded?: string, dataDir: string, platform?: string }): string {
  const platform = options.platform ?? process.platform
  const name = platform === 'win32' ? `${WEBVIEW_RUNTIME_NAME}.exe` : WEBVIEW_RUNTIME_NAME
  if (manifest.runtime === 'beside') return join(dirname(options.execPath ?? process.execPath), name)
  if (manifest.runtime !== 'embedded') return manifest.runtime
  if (!options.embedded) throw new Error('This app was built with an embedded Craft runtime, but none was compiled in.')
  const bytes = readFileSync(options.embedded)
  const digest = createHash('sha256').update(bytes).digest('hex')
  const target = join(options.dataDir, 'runtime', digest.slice(0, 16), name)
  const current = existsSync(target) ? createHash('sha256').update(readFileSync(target)).digest('hex') : ''
  if (current !== digest) {
    mkdirSync(dirname(target), { recursive: true })
    const temporary = `${target}.${process.pid}`
    writeFileSync(temporary, bytes, { mode: 0o755 })
    renameSync(temporary, target)
  }
  if (platform !== 'win32') chmodSync(target, 0o755)
  return target
}

async function waitForExit(pid: number, timeoutMs = 15_000): Promise<void> {
  const until = Date.now() + timeoutMs
  while (isAlive(pid) && Date.now() < until) await Bun.sleep(100)
}

export interface SpawnedWindow {
  exited: Promise<number>
  kill: () => void
}

export interface RunWebviewAppOptions {
  manifest: WebviewAppManifest
  views: WebviewViews
  /** The app's agent module, loaded after the lock is held so a second launch never boots the app. */
  module?: () => Promise<unknown>
  /** The Craft binary compiled into this executable (`runtime: 'embedded'`). */
  embeddedRuntime?: string
  /** This launch's arguments. Default: the process's, less the executable. */
  argv?: string[]
  paths?: ReturnType<typeof desktopAppPaths>
  /** Send console output to the log file when there is no terminal. Default `true`. */
  logWhenDetached?: boolean
  /** For tests: stand in for the Craft process. */
  spawn?: (command: string[], env: Record<string, string>) => SpawnedWindow
  /** For tests: the platform whose second-launch behavior to use. Default: this one. */
  platform?: string
  /** For tests: called with the agent once it serves. */
  onAgent?: (agent: WebviewAgent) => void
  /**
   * The app's own routes, the actions they name and its middleware, compiled
   * in by the build (`agent.appRoutes`). Served after the agent module's
   * `fetch`; a path no route matches goes on to the views
   * (stacksjs/stacks#3368).
   */
  app?: Pick<StacksAgentHandlerOptions, 'routes' | 'actions' | 'middleware'>
  /**
   * The app's own SQLite database, at `<dataDir>/database.sqlite`, brought up
   * to date before the agent module loads (`agent.database`). `migrate` is
   * `migrateCompiledDatabase` from `@stacksjs/database/compiled-migrations`,
   * passed in by the generated entry so this launcher depends on no database
   * package. If it fails, the app does not start, and the reason is logged
   * (stacksjs/stacks#3368).
   */
  database?: WebviewDatabase
  /**
   * The project's `config/*.ts`, compiled in by the build (`agent.config`),
   * each as a static `import()`. They are registered with `@stacksjs/config`
   * and loaded before the agent module, so the app runs on its own config
   * rather than the framework defaults. A file that throws stops the start,
   * with the reason in the log (stacksjs/stacks#3368).
   */
  config?: BundledConfig
}

/** What `runWebviewApp` needs to bring the app's database up to date. */
export interface WebviewDatabase {
  /** Every migration the build applied, by file name, as SQL. */
  migrations: Record<string, string>
  migrate: (options: { databasePath: string, migrations: Record<string, string> }) => { applied: string[] }
}

function defaultArgv(): string[] {
  // A compiled executable's argv is [exe, virtual entry, ...]; from source it is [bun, script, ...].
  return process.argv.slice(2)
}

function spawnCraft(command: string[], env: Record<string, string>): SpawnedWindow {
  const child = Bun.spawn(command, { env: { ...process.env, ...env }, stdio: ['ignore', 'inherit', 'pipe'] })
  void new Response(child.stderr).text().then((stderr) => {
    const lines = stderr.split('\n').filter(line => line.trim())
    if (lines.length) console.error(`[craft] ${lines.join('\n')}`)
  })
  return { exited: child.exited, kill: () => child.kill() }
}

/**
 * Lock, agent, window; resolves with the exit code once the window closes. A
 * second launch forwards its arguments to the first, raises its window, and
 * resolves 0 without booting anything.
 */
export async function runWebviewApp(options: RunWebviewAppOptions): Promise<number> {
  const { manifest } = options
  const paths = options.paths ?? desktopAppPaths(manifest.appName)
  const tag = `[${manifest.appName}]`
  const loggingToFile = options.logWhenDetached !== false && logToFileWhenDetached(paths.logFile)
  const launch = parseLaunchArguments(options.argv ?? defaultArgv(), manifest.urlSchemes)
  const incoming: SecondInstanceLaunch = { args: launch.args, cwd: process.cwd(), ...(launch.url ? { url: launch.url } : {}) }
  const spawn = options.spawn ?? spawnCraft

  // Relaunched after an update or `craft.app.relaunch()`: the process being replaced still holds the lock.
  if (launch.waitPid) await waitForExit(launch.waitPid)

  let runtime: string
  try {
    runtime = resolveWebviewRuntime(manifest, { embedded: options.embeddedRuntime, dataDir: paths.dataDir })
    if (!existsSync(runtime)) throw new Error(`the Craft runtime is missing: ${runtime}`)
  }
  catch (error) {
    console.error(`${tag} could not start: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }

  const lock = acquireWebviewInstance(paths.lockFile)
  if (!lock.acquired) {
    const reached = await forwardToInstance(paths.lockFile, incoming)
    // On Windows and Linux a second Craft with the same id forwards to the running window, brings it
    // forward, and exits. Craft on macOS has no such hand-over (LaunchServices already keeps an app
    // opened from Finder or the Dock to one instance) and an older runtime does not know the flag:
    // either would open a second window, so Craft is not started there.
    if ((options.platform ?? process.platform) !== 'darwin' && manifest.runtimeFlags?.includes('--single-instance'))
      await spawn(craftWindowCommand(manifest, runtime, 'about:blank', incoming), {}).exited.catch(() => 0)
    console.log(reached ? `${tag} already running; handed over` : `${tag} already running`)
    return 0
  }

  // Tools the app spawns are found the way a terminal finds them.
  applyWidenedPath()

  let module: WebviewAgentModule = {}
  let agent: WebviewAgent
  // Set once the agent serves, for the failure path to stop it.
  let serving: WebviewAgent | undefined
  let updater: DesktopUpdater | undefined
  try {
    // Before the module loads: config reads DB_DATABASE_PATH when it is first
    // evaluated, and the module's code may open the database at once.
    if (options.database) {
      const databasePath = join(paths.dataDir, 'database.sqlite')
      const { applied } = options.database.migrate({ databasePath, migrations: options.database.migrations })
      if (applied.length) console.log(`${tag} applied ${applied.length} migration(s) to ${databasePath}`)
      process.env.DB_CONNECTION = 'sqlite'
      process.env.DB_DATABASE_PATH = databasePath
    }
    // After the database: config reads DB_DATABASE_PATH as it loads.
    if (options.config) await loadBundledConfig(options.config)
    module = options.module ? agentModuleOf(await options.module()) : {}
    if (manifest.updates) {
      updater = createDesktopUpdater({
        appName: manifest.appName,
        currentVersion: manifest.version,
        feedUrl: manifest.updates.feedUrl,
        trustedKeys: manifest.updates.publicKeys,
        channel: manifest.updates.channel,
        updatesDir: paths.updatesDir,
        beforeUpdate: module.beforeUpdate,
        beforeInstall: module.beforeInstall,
      })
    }
    const answerUpdate = updater ? updateRequestHandler(updater) : undefined
    const answerApp = options.app
      ? appRouteHandler(await stacksAgentHandler({ appRoutes: false, ...options.app }), (await import('@stacksjs/router')).isUnmatchedRouteResponse)
      : undefined
    // Whatever config the app ended up loading, say which: a compiled app
    // without its config used to run on the framework defaults in silence.
    const { describeConfigSource, settledConfigSource } = await import('@stacksjs/config/sources')
    const source = await settledConfigSource()
    if (source) console.log(`${tag} ${describeConfigSource(source)}`)
    agent = await startWebviewAgent({
      appName: manifest.appName,
      version: manifest.version,
      views: options.views,
      port: manifest.port,
      portFile: paths.portFile,
      dataDir: paths.dataDir,
      publicPaths: manifest.publicPaths,
      instanceSecret: lock.record.secret,
      handler: async (request, context) => (await answerUpdate?.(request)) ?? (await module.fetch?.(request, context)) ?? answerApp?.(request),
      onSecondInstance: next => module.secondInstance?.(next),
    })
    serving = agent
    publishInstancePort(paths.lockFile, lock.record, agent.port)
    await module.start?.({ appName: manifest.appName, version: manifest.version, origin: agent.origin, port: agent.port, dataDir: paths.dataDir, launch: incoming, ...(updater ? { updater } : {}) })
  }
  catch (error) {
    console.error(`${tag} could not start: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
    // A start can fail after the agent is serving (in the module's `start`):
    // nothing should answer for an app that is not running.
    serving?.stop()
    // Launched from Finder or a desktop entry, nobody reads the log: say why
    // in a window, the one thing a person who opened the app is looking at.
    await showFailureWindow({
      manifest,
      runtime,
      reason: error instanceof Error ? error.message : String(error),
      ...(loggingToFile ? { logFile: paths.logFile } : {}),
      spawn,
      launch: incoming,
    }).catch((shown: unknown) => console.error(`${tag} could not show why: ${shown instanceof Error ? shown.message : String(shown)}`))
    releaseWebviewInstance(paths.lockFile)
    return 1
  }
  options.onAgent?.(agent)
  console.log(`${tag} ${manifest.version} serving on ${agent.origin}`)

  const window = spawn(craftWindowCommand(manifest, runtime, agent.launchUrl(manifest.startPath), incoming), {
    // `craft.app.relaunch()` starts this executable again, not a bare window with a dead token.
    CRAFT_RELAUNCH_EXECUTABLE: process.execPath,
    CRAFT_RELAUNCH_ARGS: JSON.stringify([...(process.execPath.endsWith('bun') || process.execPath.endsWith('bun.exe') ? [process.argv[1] ?? ''] : []), `${WAIT_PID_FLAG}${process.pid}`]),
  })

  const hours = manifest.updates?.checkEveryHours ?? 24
  let timer: ReturnType<typeof setInterval> | undefined
  if (updater && hours > 0) {
    const check = (): void => { void updater!.check().catch(() => {}) }
    void agent.windowReady.then(check)
    timer = setInterval(check, hours * 3_600_000)
    timer.unref?.()
  }

  let stopped = false
  const stop = async (): Promise<void> => {
    if (stopped) return
    stopped = true
    if (timer) clearInterval(timer)
    window.kill()
    try { await module.stop?.() }
    catch (error) { console.error(`${tag} stop: ${error instanceof Error ? error.message : String(error)}`) }
    agent.stop()
    releaseWebviewInstance(paths.lockFile)
  }
  const signals = (process.platform === 'win32' ? ['SIGINT', 'SIGTERM'] : ['SIGTERM', 'SIGINT', 'SIGHUP']) as NodeJS.Signals[]
  const onSignal = (): void => { void stop().then(() => process.exit(0)) }
  for (const signal of signals) process.on(signal, onSignal)

  const code = await window.exited
  console.log(`${tag} window closed (${code})`)
  for (const signal of signals) process.off(signal, onSignal)
  await stop()
  // An installed update asked for the new version to start once this one is gone.
  await updater?.relaunchIfInstalled()
  return 0
}

/**
 * The page a failed start shows: the app's name, the reason, and where the
 * log is. Static, with no script, and every value escaped.
 */
export function renderFailurePage(options: { appName: string, reason: string, logFile?: string }): string {
  const escape = (text: string): string => text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
  const name = escape(options.appName)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${name} could not start</title>
<style>
  :root { color-scheme: light dark; --fg: #1d1d1f; --muted: #6e6e73; --bg: #ffffff; --panel: #f5f5f7; }
  @media (prefers-color-scheme: dark) { :root { --fg: #f5f5f7; --muted: #a1a1a6; --bg: #1d1d1f; --panel: #2c2c2e; } }
  body { margin: 0; padding: 28px 32px; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: var(--fg); background: var(--bg); }
  h1 { margin: 0 0 12px; font-size: 18px; font-weight: 600; }
  pre { margin: 0 0 16px; padding: 12px 14px; border-radius: 8px; background: var(--panel); white-space: pre-wrap; word-break: break-word; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  p { margin: 0; color: var(--muted); }
  code { font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }
</style>
</head>
<body>
<h1>${name} could not start</h1>
<pre>${escape(options.reason)}</pre>
<p>${options.logFile ? `Closing this window quits the app. The details are also in <code>${escape(options.logFile)}</code>.` : 'Closing this window quits the app.'}</p>
</body>
</html>
`
}

/**
 * Show why the app could not start, in a small window of its own, and resolve
 * once it is closed. The page is served from loopback for as long as the
 * window is open. The window keeps its titlebar whatever the app's own
 * window does, so it can always be moved and closed.
 */
export async function showFailureWindow(options: {
  manifest: Pick<WebviewAppManifest, 'appName' | 'appId' | 'window' | 'runtimeFlags'>
  runtime: string
  reason: string
  logFile?: string
  spawn: (command: string[], env: Record<string, string>) => SpawnedWindow
  launch?: { args?: string[], url?: string }
}): Promise<void> {
  const page = renderFailurePage({ appName: options.manifest.appName, reason: options.reason, ...(options.logFile ? { logFile: options.logFile } : {}) })
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: () => new Response(page, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': 'default-src \'none\'; style-src \'unsafe-inline\'',
        'cache-control': 'no-store',
      },
    }),
  })
  try {
    const { window } = options.manifest
    const manifest = {
      ...options.manifest,
      window: {
        title: `${options.manifest.appName} could not start`,
        width: 560,
        height: 340,
        ...(window.darkMode !== undefined ? { darkMode: window.darkMode } : {}),
      },
    }
    // The launch's link is not passed on: there is no app to open it.
    await options.spawn(craftWindowCommand(manifest, options.runtime, `http://127.0.0.1:${server.port}/`, { args: options.launch?.args ?? [] }), {}).exited
  }
  finally {
    server.stop(true)
  }
}

/**
 * Register the compiled-in config and load it. Throws when a file threw, so
 * the app does not start on the framework defaults for that section.
 */
export async function loadBundledConfig(config: BundledConfig): Promise<void> {
  const { configSource, registerBundledConfig } = await import('@stacksjs/config/sources')
  registerBundledConfig(config)
  await (await import('@stacksjs/config')).overridesReady
  const failed = configSource()?.failed ?? []
  if (failed.length) throw new Error(`config failed to load: ${failed.map(file => `config/${file.name}.ts: ${file.error}`).join('; ')}`)
}

/**
 * The app's routes as a webview handler: their answer, or nothing when no
 * route matches, so the views answer the window's pages. A route's own 404
 * (a record that is not there) is still the app's answer.
 */
export function appRouteHandler(
  handler: (request: Request) => Response | Promise<Response>,
  unmatched: (response: Response, request: Request) => boolean | Promise<boolean>,
): (request: Request) => Promise<Response | undefined> {
  return async (request) => {
    const response = await handler(request)
    return await unmatched(response, request) ? undefined : response
  }
}

/**
 * The executable's entrypoint, written by the build and compiled (or, in
 * development, run) from there. The agent module, the manifest and every
 * built view are named statically, so the compiled executable carries them:
 * nothing is read from beside it but the Craft runtime.
 */
export function renderWebviewEntry(options: {
  manifest: WebviewAppManifest
  agentEntry?: string
  /** Built views: request path (`/index.html`) to file on the build machine. */
  viewFiles?: Record<string, string>
  /** Serve the project's stx views live instead (development). */
  stxViews?: { dir: string, components?: string[], root: string }
  embeddedRuntime?: string
  launcherModule?: string
  /** Migrations to apply at launch: file name to its file on the build machine (`agent.database`). */
  migrations?: Record<string, string>
  /** Where `migrateCompiledDatabase` comes from. Default `@stacksjs/database/compiled-migrations`. */
  migrationRunner?: string
  /** The project's config files to compile in: name (`app`) to its file on the build machine (`agent.config`). */
  configFiles?: Record<string, string>
} & AgentBundleFiles): string {
  const launcher = options.launcherModule ?? fileURLToPath(import.meta.url)
  const bundled = options.routes?.length ? agentBundleSource(options) : undefined
  const files = Object.entries(options.viewFiles ?? {})
  const imports = files.map(([, file], index) => `import view${index} from ${JSON.stringify(file)} with { type: 'file' }`)
  const migrations = options.migrations ? Object.entries(options.migrations) : undefined
  if (migrations) {
    imports.push(`import { migrateCompiledDatabase } from ${JSON.stringify(options.migrationRunner ?? '@stacksjs/database/compiled-migrations')}`)
    migrations.forEach(([, file], index) => imports.push(`import migration${index} from ${JSON.stringify(file)} with { type: 'text' }`))
  }
  const database = migrations
    ? `\n  database: {\n    migrations: {\n${migrations.map(([name], index) => `      ${JSON.stringify(name)}: migration${index},`).join('\n')}\n    },\n    migrate: migrateCompiledDatabase,\n  },`
    : ''
  const configFiles = Object.entries(options.configFiles ?? {})
  const config = configFiles.length
    ? `\n  config: {\n${configFiles.map(([name, file]) => `    ${JSON.stringify(name)}: () => import(${JSON.stringify(file)}),`).join('\n')}\n  },`
    : ''
  if (options.embeddedRuntime) imports.push(`import embeddedRuntime from ${JSON.stringify(options.embeddedRuntime)} with { type: 'file' }`)
  const views = options.stxViews
    ? `{ kind: 'stx', ...${JSON.stringify(options.stxViews)} }`
    : files.length
      ? `{ kind: 'embedded', files: {\n${files.map(([path], index) => `    ${JSON.stringify(path)}: view${index},`).join('\n')}\n  } }`
      : `{ kind: 'none' }`
  return `// Written by buddy build:desktop and buddy dev:desktop (desktop.webview). Do not edit.
import process from 'node:process'
import { runWebviewApp } from ${JSON.stringify(launcher)}
${imports.join('\n')}

process.exit(await runWebviewApp({
  manifest: ${JSON.stringify(options.manifest, null, 2).replace(/\n/g, '\n  ')},
  views: ${views},
  module: ${options.agentEntry ? `() => import(${JSON.stringify(options.agentEntry)})` : 'undefined'},${options.embeddedRuntime ? '\n  embeddedRuntime,' : ''}${bundled ? `\n  app: {\n    routes: ${bundled.routes.replace(/\n/g, '\n  ')},\n    actions: ${bundled.actions.replace(/\n/g, '\n  ')},\n    middleware: ${bundled.middleware.replace(/\n/g, '\n  ')},\n  },` : ''}${database}${config}
}))
`
}

/** The agent module a project uses: `agent.entry`, else `app/Desktop/Agent.ts` when it exists. */
export function webviewAgentEntry(root: string, entry?: string): string | undefined {
  if (entry) {
    const file = isAbsolute(entry) ? entry : resolve(root, entry)
    if (!existsSync(file)) throw new Error(`desktop.webview.agent.entry does not exist: ${file}`)
    return file
  }
  const conventional = join(root, 'app/Desktop/Agent.ts')
  return existsSync(conventional) ? conventional : undefined
}

/** Copy a file and keep it executable. */
export function copyExecutable(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  if (process.platform !== 'win32') chmodSync(to, 0o755)
}
