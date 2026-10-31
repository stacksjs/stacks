import type { AgentHandler, DesktopAgent } from './agent'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { format } from 'node:util'
import { startDesktopAgent } from './agent'

/**
 * The executable of a desktop app that runs its own API (`macos.agent`). It
 * holds the single-instance lock, starts the agent, and spawns Craft's AppKit
 * host pointed at it; when the window's process exits, so does the app.
 *
 * The same code runs in two places. `buddy dev:desktop` runs it from source
 * in the project, so the app's routes load exactly as `buddy dev:api` loads
 * them. `buddy build:desktop` compiles it into `<App>.app/Contents/MacOS`,
 * with the host beside it as `craft-runtime`.
 */

/** `Contents/Resources/desktop-agent.json`, written by the build; in development, a file the dev command writes. */
export interface DesktopAgentManifest {
  appName: string
  bundleId: string
  version: string
  /** Craft's AppKit host. Relative paths resolve against the manifest's directory. */
  host: string
  /** The compiled stx screens. */
  nativeBundle: string
  /** The host's window flags (`agentHostArguments`), less `--api-url` and `--native-bundle`. */
  hostArguments: string[]
  port?: number
  staticDir?: string
  /** The project the app was built from, when its routes are loaded from there rather than bundled. */
  projectRoot?: string
  /** Whether to load the project's route registry. */
  appRoutes: boolean
}

export const AGENT_MANIFEST = 'desktop-agent.json'
export const AGENT_MANIFEST_ENV = 'STACKS_DESKTOP_AGENT_MANIFEST'

export interface DesktopAgentPaths {
  /** `~/Library/Application Support/<App>`: survives updates, which replace the bundle wholesale. */
  dataDir: string
  portFile: string
  lockFile: string
  /** `~/Library/Logs/<App>.log`, where Console.app looks. */
  logFile: string
}

export function desktopAgentPaths(appName: string, home: string = homedir()): DesktopAgentPaths {
  const dataDir = join(home, 'Library', 'Application Support', appName)
  return {
    dataDir,
    portFile: join(dataDir, 'agent.port'),
    lockFile: join(dataDir, 'agent.pid'),
    logFile: join(home, 'Library', 'Logs', `${appName}.log`),
  }
}

/** Take the lock, or return false when another live copy of the app holds it. A lock left by a crash is taken over. */
export function acquireInstanceLock(lockFile: string, pid: number = process.pid): boolean {
  mkdirSync(dirname(lockFile), { recursive: true })
  if (existsSync(lockFile)) {
    const holder = Number(readFileSync(lockFile, 'utf8').trim())
    if (holder && holder !== pid) {
      try {
        process.kill(holder, 0)
        return false
      }
      catch (error) {
        // EPERM: alive, but someone else's process. Anything else: gone.
        if ((error as NodeJS.ErrnoException).code === 'EPERM') return false
      }
    }
  }
  writeFileSync(lockFile, String(pid))
  return true
}

export function releaseInstanceLock(lockFile: string, pid: number = process.pid): void {
  try {
    if (readFileSync(lockFile, 'utf8').trim() === String(pid)) rmSync(lockFile)
  }
  catch {}
}

/**
 * Launched from Finder there is no terminal, and what the app prints would go
 * nowhere: send it to a log file instead. From a terminal the developer keeps
 * stdout and stderr. Returns whether it redirected.
 */
export function logToFileWhenDetached(logFile: string, isTTY: boolean = Boolean(process.stdout.isTTY)): boolean {
  if (isTTY) return false
  mkdirSync(dirname(logFile), { recursive: true })
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    console[level] = (...args: unknown[]) => {
      try {
        appendFileSync(logFile, `${new Date().toISOString()} ${level === 'log' ? '' : `[${level}] `}${format(...args)}\n`)
      }
      catch {}
    }
  }
  return true
}

/** The manifest next to a bundled executable (`Contents/Resources`), or the one `STACKS_DESKTOP_AGENT_MANIFEST` names. */
export function findAgentManifest(execPath: string = process.execPath, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env[AGENT_MANIFEST_ENV]) return resolve(env[AGENT_MANIFEST_ENV]!)
  const bundled = join(dirname(execPath), '..', 'Resources', AGENT_MANIFEST)
  return existsSync(bundled) ? bundled : null
}

export function readAgentManifest(file: string): DesktopAgentManifest {
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as DesktopAgentManifest
  const base = dirname(file)
  const at = (path: string) => isAbsolute(path) ? path : resolve(base, path)
  return {
    ...manifest,
    host: at(manifest.host),
    nativeBundle: at(manifest.nativeBundle),
    ...(manifest.staticDir ? { staticDir: at(manifest.staticDir) } : {}),
  }
}

/** The host's full command line: where the agent is and where the screens are, then the window. */
export function agentHostCommand(manifest: Pick<DesktopAgentManifest, 'host' | 'nativeBundle' | 'hostArguments'>, agentUrl: string): string[] {
  return [manifest.host, '--api-url', agentUrl, '--native-bundle', manifest.nativeBundle, ...manifest.hostArguments]
}

/** A route file baked into the launcher, mounted the way `app/Routes.ts` mounts it. */
export interface AgentRouteFile {
  load: () => Promise<unknown>
  /** `/api` for the `api` entry; none for a root-mounted file. */
  prefix?: string
  middleware?: string[]
}

export interface StacksAgentHandlerOptions {
  /** Imports the agent's own routes (`app/Desktop/Agent.ts`). A default-exported function answers every request itself. */
  entry?: () => Promise<unknown>
  /** Load the project's route registry from disk. Needs the project: the working directory is its root, and the process is `bun`, not a compiled binary. */
  appRoutes: boolean
  /** The registry's route files, imported statically: how a compiled launcher carries the app's routes. */
  routes?: AgentRouteFile[]
  /** The actions those routes name by string (`'Actions/SaveTab'`), imported statically for the same reason. */
  actions?: Record<string, () => Promise<{ default?: unknown }>>
}

/**
 * The app's routes and actions, answered in process by the Stacks router.
 *
 * Booted the way `buddy dev:api` boots: the user's config, then the models
 * and framework primitives on `globalThis` (actions use them unimported),
 * then the routes. A bundled app may not have the auto-import barrel the
 * project generated, which is only a warning here: its agent routes import
 * what they use.
 */
export async function stacksAgentHandler(options: StacksAgentHandlerOptions): Promise<AgentHandler> {
  try {
    const { overridesReady } = await import('@stacksjs/config')
    await overridesReady
  }
  catch (error) {
    console.warn(`[agent] config not loaded: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (options.appRoutes) {
    try {
      const { injectGlobalAutoImports } = await import('@stacksjs/server')
      await injectGlobalAutoImports()
    }
    catch (error) {
      console.warn(`[agent] models and framework globals not injected: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const { provideActions, route, serverResponse } = await import('@stacksjs/router')
  if (options.actions) provideActions(options.actions)

  const module = options.entry ? await options.entry() as { default?: unknown } : undefined
  if (typeof module?.default === 'function') return module.default as AgentHandler

  // serverResponse loads the registry (app/Routes.ts, routes/*.ts, model
  // routes) from disk on the first request, which only a run from source can
  // do: the router refuses disk route files inside a compiled binary, because
  // they cannot resolve the framework packages from there.
  if (options.appRoutes) {
    const fromProject: AgentHandler = request => serverResponse(request)
    return fromProject
  }
  for (const file of options.routes ?? []) {
    if (file.prefix || file.middleware?.length)
      // Aliases app/Routes.ts declared, which typechecked against the app's middleware there.
      await route.group({ prefix: file.prefix, middleware: file.middleware?.length ? file.middleware as Parameters<typeof route.group>[0]['middleware'] : undefined }, async () => { await file.load() })
    else
      await file.load()
  }
  const bundled: AgentHandler = request => route.handleRequest(request)
  return bundled
}

/**
 * The launcher's entrypoint, written by the build next to the screens and
 * compiled (or, in development, run) from there. It names the agent's own
 * route module by absolute path so the bundler can follow it: whatever that
 * module imports is inside the built app.
 */
export function renderAgentEntry(options: { agentEntry?: string, launcherModule?: string, routes?: Array<{ file: string, prefix?: string, middleware?: string[] }>, actions?: Record<string, string> } = {}): string {
  const launcher = options.launcherModule ?? fileURLToPath(import.meta.url)
  const entry = options.agentEntry ? `() => import(${JSON.stringify(options.agentEntry)})` : 'undefined'
  const routes = options.routes?.length
    ? `[\n${options.routes.map(file => `    { load: () => import(${JSON.stringify(file.file)})${file.prefix ? `, prefix: ${JSON.stringify(file.prefix)}` : ''}${file.middleware?.length ? `, middleware: ${JSON.stringify(file.middleware)}` : ''} },`).join('\n')}\n  ]`
    : '[]'
  const actionEntries = Object.entries(options.actions ?? {})
  const actions = actionEntries.length
    ? `{\n${actionEntries.map(([name, file]) => `    ${JSON.stringify(name)}: () => import(${JSON.stringify(file)}),`).join('\n')}\n  }`
    : '{}'
  return `// Written by buddy build:desktop and buddy dev:desktop (macos.agent). Do not edit.
import process from 'node:process'
import { findAgentManifest, readAgentManifest, runDesktopAgentApp, stacksAgentHandler } from ${JSON.stringify(launcher)}

const file = findAgentManifest()
if (!file) {
  console.error('No desktop-agent.json beside this executable, and STACKS_DESKTOP_AGENT_MANIFEST is not set.')
  process.exit(1)
}
const manifest = readAgentManifest(file)
process.exit(await runDesktopAgentApp({
  manifest,
  handler: () => stacksAgentHandler({ entry: ${entry}, appRoutes: manifest.appRoutes, routes: ${routes}, actions: ${actions} }),
}))
`
}

export interface RunDesktopAgentAppOptions {
  manifest: DesktopAgentManifest
  /** Built after the lock is held, so a second launch never boots the app. */
  handler: () => Promise<AgentHandler>
  paths?: DesktopAgentPaths
  /** Send console output to `paths.logFile` when there is no terminal. Default `true`. */
  logWhenDetached?: boolean
  /** For tests: spawn something other than the manifest's host. */
  spawn?: (command: string[]) => { exited: Promise<number>, kill: () => void }
}

/**
 * Lock, log, agent, host; resolves with the exit code once the window's
 * process ends (or 0 at once when another copy is already running, which
 * brings its window forward the moment the user activates it).
 */
export async function runDesktopAgentApp(options: RunDesktopAgentAppOptions): Promise<number> {
  const { manifest } = options
  const paths = options.paths ?? desktopAgentPaths(manifest.appName)
  const tag = `[${manifest.appName}]`
  if (options.logWhenDetached !== false) logToFileWhenDetached(paths.logFile)

  if (!acquireInstanceLock(paths.lockFile)) {
    console.log(`${tag} already running`)
    return 0
  }
  if (!existsSync(manifest.host)) {
    console.error(`${tag} the AppKit host is missing: ${manifest.host}`)
    releaseInstanceLock(paths.lockFile)
    return 1
  }
  if (!existsSync(manifest.nativeBundle)) {
    console.error(`${tag} the native screens are missing: ${manifest.nativeBundle}`)
    releaseInstanceLock(paths.lockFile)
    return 1
  }

  let agent: DesktopAgent
  try {
    if (manifest.projectRoot && manifest.appRoutes) process.chdir(manifest.projectRoot)
    agent = await startDesktopAgent({
      handler: await options.handler(),
      name: manifest.appName,
      version: manifest.version,
      port: manifest.port,
      portFile: paths.portFile,
      staticDir: manifest.staticDir,
    })
  }
  catch (error) {
    console.error(`${tag} could not start: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
    releaseInstanceLock(paths.lockFile)
    return 1
  }
  console.log(`${tag} ${manifest.version} serving on ${agent.url}`)

  const command = agentHostCommand(manifest, agent.url)
  const host = options.spawn
    ? options.spawn(command)
    : (() => {
        const child = Bun.spawn(command, { stdio: ['ignore', 'inherit', 'pipe'] })
        void new Response(child.stderr).text().then((stderr) => {
          const lines = stderr.split('\n').filter(line => line.trim())
          if (lines.length) console.error(`[craft] ${lines.join('\n')}`)
        })
        return { exited: child.exited, kill: () => child.kill() }
      })()

  let stopped = false
  const stop = (): void => {
    if (stopped) return
    stopped = true
    host.kill()
    agent.stop()
    releaseInstanceLock(paths.lockFile)
  }
  const onSignal = (): void => {
    stop()
    process.exit(0)
  }
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) process.on(signal, onSignal)

  const code = await host.exited
  console.log(`${tag} window closed (${code})`)
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) process.off(signal, onSignal)
  stop()
  return 0
}
