import type { OwnedProcess } from '@stacksjs/cli/owned-process'
import { dirname, extname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { createServeRelay, reserveRelayWorkerPort, retireRelayWorker } from '@stacksjs/cli/serve-relay'
import { Action } from '@stacksjs/enums'
import { resolveApiHost, resolveApiPort } from '../helpers/api-host'
import { actionNodePath, developmentConditionForProject, developmentWatchFlag, resolveActionFile } from '../helpers/utils'
import { serveAppRestart } from './app-session-control'

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
  target: ReturnType<Relay['createTarget']>
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
    const port = await reserveRelayWorkerPort()
    signal.throwIfAborted()
    const api = service.action === Action.DevApi
    // The API still watches imported source. STX owns frontend HMR.
    const watch = api ? developmentWatchFlag(service.action) : ''
    let relayTarget: AppWorker['target'] | undefined
    const child = spawnOwnedProcess([bun, developmentConditionForProject(root), watch, '--preload', preload, entry].filter(Boolean), {
      ownerRuntime: bun,
      cwd: root,
      env: {
        ...process.env,
        ...(api ? { PORT_API: String(port) } : {
          PORT: String(port),
          ...(apiPort !== undefined && { PORT_API: String(apiPort) }),
        }),
        HOST: '127.0.0.1',
        API_HOST: '127.0.0.1',
        STACKS_DEV_PUBLIC_PORT: String(service.port),
        STACKS_DEV_RELAY_WORKER: '1',
        STACKS_SERVE_RELAY_PORT: String(port),
        NODE_PATH: actionNodePath(root, process.env.NODE_PATH),
        STACKS_DEV_SERVER: '1',
      },
      stdin: 'ignore',
      stdout: verbose ? 'inherit' : 'ignore',
      stderr: verbose || !api ? 'inherit' : 'ignore',
      stopGraceMs: 0,
      ipc(message) { relayTarget?.onMessage(message) },
    })
    const probe = new AbortController()
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(readyTimeoutMs)])
    const error = new Error(`${service.name} did not become ready on port ${service.port}.`)
    const ready = Promise.race([
      child.started.then(() => waitForPort(port, readyTimeoutMs, AbortSignal.any([probe.signal, deadline]))).then((listening) => {
        if (!listening || deadline.aborted)
          throw error
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
    const worker = { child, target: relayTarget = service.relay!.createTarget(port, child.send), ready, alive: true }
    workers.add(worker)
    void child.exited.then(({ code }) => {
      worker.alive = false
      workers.delete(worker)
      worker.target.close()
      if (service.worker === worker) {
        delete service.worker
        onWorkerExit(code ? new Error(`${service.name} exited with code ${code}.`) : undefined)
      }
    }, (error: unknown) => {
      worker.alive = false
      worker.target.close()
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
    service.relay!.promote(worker.target)
    service.worker = worker
  }

  async function restart(): Promise<void> {
    const batch = new AbortController()
    const signal = AbortSignal.any([shutdown.signal, batch.signal])
    const candidates = await Promise.allSettled(services.map(async (service) => {
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
      batch.abort(new Error(`${services[stoppedCandidate]!.name} stopped before the dev services could switch over.`))
    if (signal.aborted) {
      await Promise.allSettled(candidates.map(candidate => candidate.status === 'fulfilled' ? candidate.value?.child.stop() : undefined))
      services.forEach(releaseUnusedRelay)
      signal.throwIfAborted()
    }

    // Keep the old services together until the whole replacement session is
    // ready. Swapping the targets in one tick also keeps the public API URL
    // used by the frontend's same-origin proxy stable.
    const old = services.map((service, index) => {
      const previous = service.worker
      const candidate = candidates[index]!
      if (candidate.status === 'fulfilled' && candidate.value)
        promote(service, candidate.value)
      return previous
    })
    await Promise.all(old.map(worker => worker && retireRelayWorker(worker.child, worker.target, drainMs)))
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
  try {
    closeRestart = serveAppRestart(root, 'dev', () => {
      restarting ??= initialStart.then(restart).finally(() => { restarting = undefined })
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

  return {
    finished,
    stop() {
      if (stopping)
        return stopping
      shutdown.abort()
      closeRestart?.()
      for (const service of services)
        service.relay?.stop()
      stopping = Promise.allSettled([...workers].map((worker) => {
        worker.target.close()
        return worker.child.stop()
      })).then(() => finish())
      return stopping
    },
  }
}
