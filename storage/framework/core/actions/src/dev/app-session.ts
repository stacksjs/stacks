import type { OwnedProcess } from '@stacksjs/cli/owned-process'
import process from 'node:process'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { Action } from '@stacksjs/enums'
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

interface AppService {
  name: string
  action: Action.Dev | Action.DevApi
  port?: number
  worker?: OwnedProcess
}

const restartReadyTimeoutMs = 90_000

function apiReadyPort(message: unknown): number | undefined {
  if (message && typeof message === 'object' && 'type' in message && message.type === 'stacks:api-ready'
    && 'port' in message && typeof message.port === 'number' && Number.isInteger(message.port)
    && message.port > 0 && message.port <= 65535)
    return message.port
}

export function startAppDevSession(options: AppDevSessionOptions): { finished: Promise<void>, stop: () => Promise<void> } {
  const { root, target, frontendPort, apiPort, verbose, waitForPort, reportError } = options
  const services: AppService[] = []
  if (target !== 'api')
    services.push({ name: 'Frontend', action: Action.Dev, port: frontendPort })
  if (target !== 'frontend')
    services.push({ name: 'API', action: Action.DevApi, port: apiPort })
  const configuredApiPort = Number(process.env.PORT_API?.trim() || 3008)
  const apiProbePort = target === 'api' && Number.isInteger(configuredApiPort)
    && configuredApiPort > 0 && configuredApiPort <= 65535 ? configuredApiPort : undefined
  const runtime = Bun.which('bun', { cwd: root })
  if (!runtime)
    throw new Error('Could not find Bun to start the app services.')
  const bun: string = runtime

  const { promise: finished, resolve: finish, reject: fail } = Promise.withResolvers<void>()
  const shutdown = new AbortController()
  let stopping: Promise<void> | undefined
  let restarting: Promise<void> | undefined
  let closeRestart: (() => void) | undefined

  function onWorkerExit(error?: Error): void {
    if (restarting || shutdown.signal.aborted)
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

  async function run(service: AppService) {
    const entry = await resolveActionFile(service.action, root)
    if (shutdown.signal.aborted)
      return
    if (!entry)
      throw new Error(`${service.name} could not find its development action.`)

    // STX handles frontend HMR. Keep Bun's file watcher for the API.
    const watch = service.action === Action.DevApi ? developmentWatchFlag(service.action) : ''
    const listening = target === 'api' ? Promise.withResolvers<number>() : undefined
    const pinnedApiPort = target === 'api' ? service.port : undefined
    const worker = spawnOwnedProcess([bun, developmentConditionForProject(root), watch, entry].filter(Boolean), {
      ownerRuntime: bun,
      cwd: root,
      env: {
        ...process.env,
        ...(frontendPort !== undefined && { PORT: String(frontendPort) }),
        ...(target === 'frontend' && { STACKS_DEV_FIXED_FRONTEND_PORT: '1' }),
        ...(apiPort !== undefined && { PORT_API: String(apiPort) }),
        // A standalone API may use config/ports.ts or bind to port zero on
        // first launch. Once it announces the actual port, reuse it on restart.
        ...(pinnedApiPort !== undefined && { PORT_API: String(pinnedApiPort) }),
        NODE_PATH: actionNodePath(root, process.env.NODE_PATH),
        STACKS_DEV_SERVER: '1',
      },
      stdin: 'ignore',
      stdout: verbose ? 'inherit' : 'ignore',
      stderr: verbose || service.action === Action.Dev ? 'inherit' : 'ignore',
      ...(listening && {
        ipc(message: unknown) {
          const port = apiReadyPort(message)
          if (port !== undefined && service.worker === worker) {
            if (pinnedApiPort === undefined)
              service.port = port
            listening.resolve(port)
          }
        },
      }),
      // Match the grace period of the unified dev command.
      stopGraceMs: 1500,
    })
    service.worker = worker
    void worker.exited.then(({ code }) => {
      if (service.worker === worker)
        delete service.worker
      onWorkerExit(code ? new Error(`${service.name} exited with code ${code}.`) : undefined)
    }, (error: unknown) => {
      onWorkerExit(new Error(`${service.name}: ${error instanceof Error ? error.message : error}`))
    })
    return { worker, listening: listening?.promise }
  }

  async function waitUntilReady(service: AppService, port: number | undefined, { worker, listening }: NonNullable<Awaited<ReturnType<typeof run>>>): Promise<void> {
    const probe = new AbortController()
    const probePort = listening ? (port === undefined ? apiProbePort : undefined) : port
    const address = (port ?? probePort) === undefined ? '' : ` on port ${port ?? probePort}`
    const error = new Error(`${service.name} did not come back${address}.`)
    const signal = AbortSignal.any([probe.signal, shutdown.signal])
    const timeout = setTimeout(() => probe.abort(), restartReadyTimeoutMs)
    try {
      const ready = worker.started.then(() => {
        const checks: Promise<void>[] = []
        // The built-in API reports its actual listener. Fixed-port overrides
        // can still be probed if the previous worker never sent that report.
        if (listening) {
          checks.push(listening.then((observed) => {
            if (port !== undefined && observed !== port)
              throw new Error(`${service.name} came back on port ${observed} instead of ${port}.`)
          }))
        }
        if (probePort !== undefined) {
          checks.push(waitForPort(probePort, restartReadyTimeoutMs, signal).then((ready) => {
            if (!ready || signal.aborted)
              throw error
          }))
        }
        return Promise.race(checks)
      })
      await Promise.race([
        ready,
        new Promise<never>((_, reject) => {
          if (signal.aborted)
            reject(error)
          else
            signal.addEventListener('abort', () => reject(error), { once: true })
        }),
        worker.exited.then(({ code }) => {
          // A combined session can serve all its pages from the API.
          if (code || target || service.action === Action.DevApi)
            throw new Error(`${service.name} exited before it was ready${address} (code ${code}).`)
        }),
      ])
    }
    finally {
      clearTimeout(timeout)
      probe.abort()
    }
  }

  async function restart(): Promise<void> {
    const stopped = await Promise.allSettled(services.map(service => service.worker?.stop()))
    const results = await Promise.allSettled(services.map(async (service, index) => {
      const stop = stopped[index]!
      if (stop.status === 'rejected')
        throw stop.reason
      const port = service.port
      const started = await run(service)
      if (started)
        await waitUntilReady(service, port, started)
    }))
    if (shutdown.signal.aborted)
      throw new Error('The development session is shutting down.')
    const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : String(result.reason)] : [])
    if (errors.length)
      throw new Error(errors.join(' '))
  }

  const initialStart = Promise.all(services.map(async (service) => {
    try {
      await run(service)
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

  // A registered session can recover stopped services on an update. When
  // registration is unavailable its workers alone keep the session alive.
  if (!closeRestart) {
    void initialStart.then(async () => {
      await Promise.allSettled(services.map(service => service.worker?.exited))
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
      stopping = Promise.allSettled(services.map(service => service.worker?.stop())).then(() => finish())
      return stopping
    },
  }
}
