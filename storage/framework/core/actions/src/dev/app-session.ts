import type { OwnedProcess } from '@stacksjs/cli/owned-process'
import process from 'node:process'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { Action } from '@stacksjs/enums'
import { actionNodePath, developmentConditionForProject, developmentWatchFlag, resolveActionFile } from '../helpers/utils'
import { serveAppDevRestart } from './app-session-control'

interface AppDevSessionOptions {
  root: string
  frontendPort: number
  apiPort: number
  verbose?: boolean
  waitForPort: (port: number, timeoutMs: number, signal: AbortSignal) => Promise<boolean>
  reportError: (message: string) => void
}

interface AppService {
  name: string
  action: Action.Dev | Action.DevApi
  port: number
  worker?: OwnedProcess
}

const restartReadyTimeoutMs = 90_000

export function startAppDevSession(options: AppDevSessionOptions): { finished: Promise<void>, stop: () => Promise<void> } {
  const { root, frontendPort, apiPort, verbose, waitForPort, reportError } = options
  const services: AppService[] = [
    { name: 'Frontend', action: Action.Dev, port: frontendPort },
    { name: 'API', action: Action.DevApi, port: apiPort },
  ]
  const runtime = Bun.which('bun', { cwd: root })
  if (!runtime)
    throw new Error('Could not find Bun to start the app services.')
  const bun: string = runtime

  const { promise: finished, resolve: finish } = Promise.withResolvers<void>()
  const shutdown = new AbortController()
  let stopping: Promise<void> | undefined
  let restarting: Promise<void> | undefined

  async function run(service: AppService): Promise<OwnedProcess | undefined> {
    const entry = await resolveActionFile(service.action, root)
    if (shutdown.signal.aborted)
      return
    if (!entry)
      throw new Error(`${service.name} could not find its development action.`)

    // STX handles frontend HMR. Keep Bun's file watcher for the API.
    const watch = service.action === Action.DevApi ? developmentWatchFlag(service.action) : ''
    const worker = spawnOwnedProcess([bun, developmentConditionForProject(root), watch, entry].filter(Boolean), {
      ownerRuntime: bun,
      cwd: root,
      env: {
        ...process.env,
        PORT: String(frontendPort),
        PORT_API: String(apiPort),
        NODE_PATH: actionNodePath(root, process.env.NODE_PATH),
        STACKS_DEV_SERVER: '1',
      },
      stdin: 'ignore',
      stdout: verbose ? 'inherit' : 'ignore',
      stderr: verbose || service.action === Action.Dev ? 'inherit' : 'ignore',
      // Match the grace period of the unified dev command.
      stopGraceMs: 1500,
    })
    service.worker = worker
    void worker.exited.then(({ code }) => {
      if (service.worker === worker)
        delete service.worker
      if (code && !restarting && !shutdown.signal.aborted)
        reportError(`${service.name} exited with code ${code}.`)
    }, (error: unknown) => {
      reportError(`${service.name}: ${error instanceof Error ? error.message : error}`)
    })
    return worker
  }

  async function waitUntilReady(service: AppService, worker: OwnedProcess): Promise<void> {
    const probe = new AbortController()
    try {
      await worker.started
      await Promise.race([
        waitForPort(service.port, restartReadyTimeoutMs, AbortSignal.any([probe.signal, shutdown.signal])).then((ready) => {
          if (!ready || shutdown.signal.aborted)
            throw new Error(`${service.name} did not come back on port ${service.port}.`)
        }),
        worker.exited.then(({ code }) => {
          // A project may serve all its pages from the API and opt out of a frontend listener.
          if (code || service.action === Action.DevApi)
            throw new Error(`${service.name} exited before it was ready on port ${service.port} (code ${code}).`)
        }),
      ])
    }
    finally {
      probe.abort()
    }
  }

  async function restart(): Promise<void> {
    const stopped = await Promise.allSettled(services.map(service => service.worker?.stop()))
    const results = await Promise.allSettled(services.map(async (service, index) => {
      const stop = stopped[index]!
      if (stop.status === 'rejected')
        throw stop.reason
      const worker = await run(service)
      if (worker)
        await waitUntilReady(service, worker)
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
      reportError(error instanceof Error ? error.message : String(error))
    }
  }))
  let closeRestart: (() => void) | undefined
  try {
    closeRestart = serveAppDevRestart(root, () => {
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
