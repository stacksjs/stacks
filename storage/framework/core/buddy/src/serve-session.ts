import type { OwnedProcess } from '@stacksjs/cli/owned-process'
import process from 'node:process'
import { serveAppRestart } from '@stacksjs/actions/dev/app-session-control'
import { resolveApiHost } from '@stacksjs/actions/helpers/api-host'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { createServeRelay, reserveRelayWorkerPort, retireRelayWorker } from '@stacksjs/cli/serve-relay'
import { log } from '@stacksjs/logging'
import { isCompiledBinary, projectCliEntry, projectPath } from '@stacksjs/path'
import { serveReadyHeader, serveReadyPath } from './serve-readiness'

type ServeCommand = 'serve' | 'serve:api'
interface ServeOptions { port?: string | number, verbose?: boolean }
type Relay = ReturnType<typeof createServeRelay>
interface ServeWorker {
  child: OwnedProcess
  token: string
  apiReady: Promise<number>
  privatePort: number
  target: ReturnType<Relay['createTarget']>
}

async function servingPort(configured: string | number | undefined, web: boolean): Promise<number> {
  const port = Number(configured)
  if (port || web)
    return port || 3000
  const { config, overridesReady } = await import('@stacksjs/config')
  await overridesReady
  return config.ports?.api || 3008
}

export function isServeWorker(): boolean {
  return process.env.STACKS_SERVE_WORKER === '1' && typeof process.send === 'function'
}

async function waitForWebServer(port: number, token: string, signal: AbortSignal): Promise<number> {
  const url = `http://127.0.0.1:${port}${serveReadyPath}`
  while (!signal.aborted) {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { [serveReadyHeader]: token, connection: 'close' },
      redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(750)]),
    }).catch(() => null)
    if (response?.status === 204 && response.headers.get(serveReadyHeader) === token)
      return port

    await Bun.sleep(100)
  }
  throw new Error('The web server did not become ready.')
}

export async function runServeSession(command: ServeCommand, options?: ServeOptions): Promise<void> {
  const root = projectPath()
  const compiled = isCompiledBinary()
  const runtime = Bun.which('bun', { cwd: root }) ?? (compiled ? undefined : process.execPath)
  if (!runtime)
    throw new Error('Could not find Bun to start the app.')
  const bun: string = runtime
  const web = command === 'serve'
  const configuredPort = options?.port || process.env.PORT
  process.env.APP_ENV ||= 'production'
  const publicHost = web ? (process.env.HOST?.trim() || '0.0.0.0') : resolveApiHost()
  const publicPort = await servingPort(configuredPort, web)
  // Linux and macOS can reset connections still queued on a closing shared
  // listener. Keep the public listener alive across worker replacements.
  const relay = createServeRelay(publicHost, publicPort)
  const requestedGrace = Number(process.env.SHUTDOWN_GRACE_MS)
  const grace = Number.isFinite(requestedGrace) && requestedGrace > 0 ? requestedGrace : 15_000
  const shutdown = new AbortController()
  const { promise: finished, resolve: finish, reject: fail } = Promise.withResolvers<void>()
  const children = new Set<OwnedProcess>()
  void finished.catch(() => {})
  let worker: ServeWorker | undefined
  let restarting: Promise<void> | undefined
  let closeControl: (() => void) | undefined

  async function startWorker(): Promise<ServeWorker> {
    const privatePort = await reserveRelayWorkerPort()
    shutdown.signal.throwIfAborted()
    const entry = projectCliEntry(root)
    // Resolve the project's CLI again after each update. Keep the current
    // Bun flags so sources and dist packages resolve as in the original run.
    const executable = entry
      ? [bun, ...process.execArgv, entry]
      : compiled
        ? [process.execPath]
        : [process.execPath, ...process.execArgv, Bun.main]
    const token = crypto.randomUUID()
    const apiReady = Promise.withResolvers<number>()
    let target: ServeWorker['target'] | undefined
    const child = spawnOwnedProcess([...executable, command, ...(options?.verbose ? ['--verbose'] : [])], {
      cwd: root,
      env: {
        ...process.env,
        PORT: configuredPort === undefined ? undefined : String(configuredPort),
        STACKS_SERVE_WORKER: '1',
        STACKS_SERVE_RELAY_PORT: String(privatePort),
        STACKS_SERVE_READY_TOKEN: web ? token : undefined,
      },
      ownerRuntime: bun,
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
      stopGraceMs: grace,
      ipc(message) {
        target?.onMessage(message)
        if (!web && message && typeof message === 'object' && 'type' in message && message.type === 'stacks:api-ready'
          && 'port' in message && typeof message.port === 'number' && Number.isInteger(message.port)
          && message.port > 0 && message.port <= 65535) {
          apiReady.resolve(message.port)
        }
      },
    })
    const relayTarget = relay.createTarget(privatePort, child.send)
    target = relayTarget
    children.add(child)
    void child.exited.then(({ code }) => {
      relayTarget.close()
      children.delete(child)
      if (shutdown.signal.aborted || worker?.child !== child)
        return
      if (code)
        fail(new Error(`Buddy ${command} exited with status ${code}.`))
      else
        finish()
    }, (error: unknown) => {
      relayTarget.close()
      if (!shutdown.signal.aborted && worker?.child === child)
        fail(error)
    })
    return { child, token, apiReady: apiReady.promise, privatePort, target: relayTarget }
  }

  async function ready({ child, token, apiReady, privatePort }: ServeWorker): Promise<void> {
    const wait = new AbortController()
    const signal = AbortSignal.any([wait.signal, shutdown.signal, AbortSignal.timeout(90_000)])
    const timeout = new Promise<never>((_, reject) => {
      const abort = () => reject(new Error(`The replacement for buddy ${command} did not become ready.`))
      if (signal.aborted)
        abort()
      else
        signal.addEventListener('abort', abort, { once: true })
    })
    try {
      const port = await Promise.race([
        child.started.then(() => web ? waitForWebServer(privatePort, token, signal) : apiReady),
        child.exited.then(({ code }) => { throw new Error(`Buddy ${command} exited before it was ready (status ${code}).`) }),
        timeout,
      ])
      if (port !== privatePort)
        throw new Error(`Buddy ${command} listened on port ${port} instead of ${privatePort}.`)
    }
    finally {
      wait.abort()
    }
  }

  async function restart(): Promise<void> {
    const previous = worker!
    shutdown.signal.throwIfAborted()
    const candidate = await startWorker()
    try {
      await ready(candidate)
      shutdown.signal.throwIfAborted()
      relay.promote(candidate.target)
      worker = candidate
    }
    catch (error) {
      await candidate.child.stop()
      throw error
    }
    await retireRelayWorker(previous.child, previous.target, grace)
  }

  const stopChildren = () => Promise.all([...children].map(child => child.stop()))
  const stop = () => {
    shutdown.abort()
    closeControl?.()
    relay.stop()
    void stopChildren().then(() => finish(), fail)
  }
  const signals = ['SIGINT', 'SIGTERM'] as const
  for (const signal of signals)
    process.on(signal, stop)
  try {
    await relay.listening
    worker = await startWorker()
    await ready(worker)
    relay.promote(worker.target)
    log.info(`Buddy ${command} is listening on port ${publicPort}.`)
    try {
      closeControl = serveAppRestart(root, 'serve', () => {
        restarting ??= restart().finally(() => { restarting = undefined })
        return restarting
      })
    }
    catch {
      log.warn(`Buddy could not register ${command} for Software Update restarts.`)
    }
    await finished
  }
  finally {
    shutdown.abort()
    closeControl?.()
    relay.stop()
    for (const signal of signals)
      process.off(signal, stop)
    await stopChildren()
  }
}
