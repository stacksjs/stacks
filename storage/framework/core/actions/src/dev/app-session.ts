import type { OwnedProcess } from '@stacksjs/cli/owned-process'
import { watch } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { createServeRelay, reserveRelayWorkerPort, retireRelayWorker } from '@stacksjs/cli/serve-relay'
import { Action } from '@stacksjs/enums'
import { resolveApiHost, resolveApiPort } from '../helpers/api-host'
import { actionNodePath, developmentConditionForProject, resolveActionFile } from '../helpers/utils'
import { serveAppRestart } from './app-session-control'
import { devRuntimeSource, frontendBuildId } from './frontend-hmr'

interface AppDevSessionOptions {
  root: string
  target?: 'frontend' | 'api'
  frontendPort?: number
  apiPort?: number
  verbose?: boolean
  waitForPort: (port: number, timeoutMs: number, signal: AbortSignal) => Promise<boolean>
  reportError: (message: string) => void
}

type Relay = ReturnType<typeof createServeRelay>
interface AppWorker {
  child: OwnedProcess
  target?: ReturnType<Relay['createTarget']>
  ready: Promise<boolean>
  alive: boolean
}
interface AppService {
  name: string
  action: Action.Dev | Action.DevApi
  port?: number
  relay?: Relay
  worker?: AppWorker
}

const readyTimeoutMs = 90_000
const relayPreload = fileURLToPath(new URL(`../helpers/serve-relay-worker${extname(import.meta.path)}`, import.meta.url))
const ignoredWatchPaths = /(?:^|\/)(?:\.(?!config\/)[^/]+|node_modules|dist|vendor|tests)(?:\/|$)|^storage\/(?!framework\/(?:api|core|defaults|models|server)\/)/i

export function startAppDevSession(options: AppDevSessionOptions): { finished: Promise<void>, stop: () => Promise<void> } {
  const { root, target, frontendPort, apiPort, verbose, waitForPort, reportError } = options
  const services: AppService[] = []
  if (target !== 'api')
    services.push({ name: 'Frontend', action: Action.Dev, port: frontendPort ?? (Number(process.env.PORT) || 3000) })
  if (target !== 'frontend')
    services.push({ name: 'API', action: Action.DevApi, port: apiPort })
  const runtime = Bun.which('bun', { cwd: root })
  if (!runtime)
    throw new Error('Could not find Bun to start the app services.')
  const bun: string = runtime
  const requestedGrace = Number(process.env.SHUTDOWN_GRACE_MS)
  const drainMs = Number.isFinite(requestedGrace) && requestedGrace > 0 ? requestedGrace : 1500
  const frontendBuild = crypto.randomUUID()

  const { promise: finished, resolve: finish, reject: fail } = Promise.withResolvers<void>()
  const shutdown = new AbortController()
  const workers = new Set<AppWorker>()
  let stopping: Promise<void> | undefined
  let restarting: Promise<void> | undefined
  let closeRestart: (() => void) | undefined

  function onWorkerExit(error?: Error): void {
    if (shutdown.signal.aborted)
      return
    if (target) {
      closeRestart?.()
      if (error)
        fail(error)
      else
        finish()
    }
    else if (error) {
      reportError(error.message)
    }
  }

  async function bindRelay(service: AppService): Promise<void> {
    if (service.relay)
      return
    const api = service.action === Action.DevApi
    if (api && service.port === undefined) {
      const { config, overridesReady } = await import('@stacksjs/config')
      await overridesReady
      service.port = resolveApiPort(process.env.PORT_API, config.ports?.api)
    }
    shutdown.signal.throwIfAborted()
    const relay = createServeRelay(api ? resolveApiHost() : '0.0.0.0', service.port!)
    service.relay = relay
    try {
      service.port = await relay.listening
    }
    catch (error) {
      delete service.relay
      throw error
    }
  }

  async function startWorker(service: AppService, signal: AbortSignal): Promise<AppWorker> {
    const entry = await resolveActionFile(service.action, root)
    if (!entry)
      throw new Error(`${service.name} could not find its development action.`)

    const localPreload = resolve(dirname(entry), '../helpers', `serve-relay-worker${extname(entry)}`)
    const preload = await Bun.file(localPreload).exists() ? localPreload : relayPreload
    const api = service.action === Action.DevApi
    // Let Windows assign the API port at bind time to avoid reservation
    // races. The other workers keep the private port passed to their entry.
    const port = api && process.platform === 'win32' ? 0 : await reserveRelayWorkerPort()
    signal.throwIfAborted()
    const { promise: relayReady, resolve: markRelayReady } = Promise.withResolvers<void>()
    const { promise: workerPort, resolve: reportWorkerPort } = Promise.withResolvers<number>()
    if (port)
      reportWorkerPort(port)
    const child = spawnOwnedProcess([bun, developmentConditionForProject(root), '--preload', preload, entry].filter(Boolean), {
      ownerRuntime: bun,
      cwd: root,
      env: {
        ...process.env,
        ...(api ? { PORT_API: String(port) } : {
          PORT: String(port),
          STX_BUILD_ID: process.env.STX_BUILD_ID || frontendBuildId(entry, frontendBuild),
          ...(apiPort !== undefined && { PORT_API: String(apiPort) }),
        }),
        HOST: '127.0.0.1',
        API_HOST: '127.0.0.1',
        STACKS_DEV_PUBLIC_PORT: String(service.port),
        STACKS_DEV_RELAY_WORKER: '1',
        STACKS_DEV_RELAY_REPLACEMENT: service.worker ? '1' : undefined,
        NODE_PATH: actionNodePath(root, process.env.NODE_PATH),
        STACKS_DEV_SERVER: '1',
      },
      stdin: 'ignore',
      stdout: verbose ? 'inherit' : 'ignore',
      stderr: verbose || !api ? 'inherit' : 'ignore',
      stopGraceMs: 0,
      ipc(message) {
        if (message && typeof message === 'object' && 'type' in message) {
          if (message.type === 'stacks:dev-relay-ready')
            markRelayReady()
          if (message.type === 'stacks:api-ready' && 'port' in message && typeof message.port === 'number'
            && Number.isInteger(message.port) && message.port > 0 && message.port <= 65535)
            reportWorkerPort(message.port)
        }
        worker.target?.onMessage(message)
      },
    })
    const probe = new AbortController()
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(readyTimeoutMs)])
    const error = new Error(`${service.name} did not become ready on port ${service.port}.`)
    const ready = Promise.race([
      Promise.all([relayReady, workerPort]).then(async ([, actualPort]) => {
        const listening = await waitForPort(actualPort, readyTimeoutMs, AbortSignal.any([probe.signal, deadline]))
        if (!listening || deadline.aborted || probe.signal.aborted)
          throw error
        worker.target = service.relay!.createTarget(actualPort, child.send)
        return true
      }),
      child.exited.then(({ code }) => {
        // A combined project can serve all of its pages from the API.
        if (code || api || target || service.worker)
          throw new Error(`${service.name} exited before it was ready (code ${code}).`)
        return false
      }),
      new Promise<never>((_, reject) => {
        const abort = () => reject(signal.aborted ? signal.reason : error)
        if (deadline.aborted)
          abort()
        else
          deadline.addEventListener('abort', abort, { once: true, signal: probe.signal })
      }),
    ]).finally(() => probe.abort())
    void ready.catch(() => {})
    const worker: AppWorker = { child, ready, alive: true }
    workers.add(worker)
    void child.exited.then(({ code }) => {
      worker.alive = false
      workers.delete(worker)
      worker.target?.close()
      if (service.worker === worker) {
        delete service.worker
        onWorkerExit(code ? new Error(`${service.name} exited with code ${code}.`) : undefined)
      }
    }, (error: unknown) => {
      worker.alive = false
      worker.target?.close()
      if (service.worker === worker) {
        delete service.worker
        onWorkerExit(new Error(`${service.name}: ${error instanceof Error ? error.message : error}`))
      }
    })
    return worker
  }

  function releaseUnusedRelay(service: AppService): void {
    if (service.worker)
      return
    service.relay?.stop()
    delete service.relay
  }

  async function prepare(service: AppService, signal = shutdown.signal): Promise<AppWorker | undefined> {
    let worker: AppWorker | undefined
    try {
      await bindRelay(service)
      worker = await startWorker(service, signal)
      if (await worker.ready)
        return worker
      releaseUnusedRelay(service)
      return undefined
    }
    catch (error) {
      await worker?.child.stop()
      releaseUnusedRelay(service)
      throw error
    }
  }

  function promote(service: AppService, worker: AppWorker): void {
    service.relay!.promote(worker.target!)
    service.worker = worker
  }

  async function restart(replacements: AppService[]): Promise<void> {
    const batch = new AbortController()
    const signal = AbortSignal.any([shutdown.signal, batch.signal])
    const candidates = await Promise.allSettled(replacements.map(async (service) => {
      try {
        return await prepare(service, signal)
      }
      catch (error) {
        batch.abort(error)
        throw error
      }
    }))
    const stoppedCandidate = candidates.findIndex(candidate =>
      candidate.status === 'fulfilled' && candidate.value?.alive === false,
    )
    if (stoppedCandidate !== -1)
      batch.abort(new Error(`${replacements[stoppedCandidate]!.name} stopped before the dev services could switch over.`))
    if (signal.aborted) {
      await Promise.allSettled(candidates.map(candidate => candidate.status === 'fulfilled' ? candidate.value?.child.stop() : undefined))
      replacements.forEach(releaseUnusedRelay)
      signal.throwIfAborted()
    }

    // Keep the old services together until the whole replacement session is
    // ready. Swapping the targets in one tick also keeps the public API URL
    // used by the frontend's same-origin proxy stable.
    const old = replacements.map((service, index) => {
      const previous = service.worker
      const candidate = candidates[index]!
      if (candidate.status === 'fulfilled' && candidate.value)
        promote(service, candidate.value)
      return previous
    })
    await Promise.all(old.map(worker => worker?.target && retireRelayWorker(worker.child, worker.target, drainMs)))
  }

  const initialStart = Promise.all(services.map(async (service) => {
    try {
      const worker = await prepare(service)
      if (worker && !shutdown.signal.aborted) {
        promote(service, worker)
        if (target === 'api') {
          const host = resolveApiHost()
          const address = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
          console.log(`\n  ➜  API server ready: http://${address}:${service.port}\n`)
        }
      }
    }
    catch (error) {
      onWorkerExit(error instanceof Error ? error : new Error(String(error)))
    }
  }))
  let restartQueue = initialStart.then(() => {})
  function enqueueRestart(replacements: AppService[]): Promise<void> {
    const next = restartQueue.then(() => {
      shutdown.signal.throwIfAborted()
      return restart(replacements)
    })
    restartQueue = next.catch(() => {})
    return next
  }

  try {
    closeRestart = serveAppRestart(root, 'dev', () => {
      restarting ??= enqueueRestart(services).finally(() => { restarting = undefined })
      return restarting
    })
  }
  catch {
    reportError('Buddy could not register this development session for Software Update restarts.')
  }

  if (!closeRestart) {
    void initialStart.then(async () => {
      await Promise.allSettled(services.map(service => service.worker?.child.exited))
      finish()
    })
  }

  const stopWatching = watchDevSource(root, services, enqueueRestart, reportError)

  return {
    finished,
    stop() {
      if (stopping)
        return stopping
      shutdown.abort()
      stopWatching?.()
      closeRestart?.()
      for (const service of services)
        service.relay?.stop()
      stopping = Promise.allSettled([...workers].map((worker) => {
        worker.target?.close()
        return worker.child.stop()
      })).then(() => finish())
      return stopping
    },
  }
}

function sourceServices(filename: string | null, services: AppService[]): AppService[] {
  if (!filename)
    return services
  const path = filename.replaceAll('\\', '/').toLowerCase()
  if (ignoredWatchPaths.test(path) || /\.d\.[cm]?ts$/.test(path) || (!devRuntimeSource.test(path) && path !== 'bunfig.toml'))
    return []

  // STX already refreshes templates, styles and browser-only modules in place.
  const source = path.replace(/^storage\/framework\/defaults\//, '')
  if (/^(?:public|resources\/assets|stores|composables)\//.test(source))
    return []

  if (/^(?:serve\.[cm]?[jt]s$|(?:site|stx|css)\.config\.[cm]?[jt]s$|frontend\/|resources\/(?!functions\/))/.test(source))
    return services.filter(service => service.action === Action.Dev)
  if (/^(?:routes\/api(?:\.[cm]?[jt]s$|\/)|storage\/framework\/core\/actions\/src\/dev\/api\.[cm]?[jt]s$)/.test(source))
    return services.filter(service => service.action === Action.DevApi)
  return services
}

function watchDevSource(
  root: string,
  services: AppService[],
  reload: (changed: AppService[]) => Promise<void>,
  reportError: (message: string) => void,
): (() => void) | undefined {
  let debounce: ReturnType<typeof setTimeout> | undefined
  let reloading = false
  let stopped = false
  const pending = new Set<AppService>()

  function schedule(): void {
    clearTimeout(debounce)
    if (stopped || reloading)
      return
    debounce = setTimeout(async () => {
      const changed = [...pending]
      pending.clear()
      reloading = true
      try {
        await reload(changed)
      }
      catch (error) {
        if (!stopped)
          reportError(`Source reload failed: ${error instanceof Error ? error.message : error}`)
      }
      finally {
        reloading = false
        if (pending.size)
          schedule()
      }
    }, 200)
  }

  const reportWatchError = (error: unknown) => reportError(`Could not watch application source: ${error instanceof Error ? error.message : error}`)
  try {
    const watcher = watch(root, { recursive: true }, (_event, filename) => {
      const changed = sourceServices(filename, services)
      if (changed.length) {
        for (const service of changed)
          pending.add(service)
        schedule()
      }
    })
    watcher.on('error', reportWatchError)
    return () => {
      stopped = true
      clearTimeout(debounce)
      watcher.close()
    }
  }
  catch (error) {
    reportWatchError(error)
  }
}
