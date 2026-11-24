import type { OwnedProcess } from '@stacksjs/cli/owned-process'
import process from 'node:process'
import { serveAppRestart } from '@stacksjs/actions/dev/app-session-control'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { log } from '@stacksjs/logging'
import { isCompiledBinary, projectCliEntry, projectPath } from '@stacksjs/path'
import { serveReadyHeader, serveReadyPath } from './serve-readiness'

type ServeCommand = 'serve' | 'serve:api'
interface ServeOptions { port?: string | number, verbose?: boolean }

export function isServeWorker(): boolean {
  return process.env.STACKS_SERVE_WORKER === '1' && typeof process.send === 'function'
}

async function waitForWebServer(host: string | undefined, port: number, token: string, signal: AbortSignal): Promise<number> {
  const address = !host || host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '::1' : host
  const hostname = address.includes(':') && !address.startsWith('[') ? `[${address}]` : address
  const url = `http://${hostname}:${port}${serveReadyPath}`
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
  const webPort = Number(configuredPort) || 3000
  const requestedGrace = Number(process.env.SHUTDOWN_GRACE_MS)
  const grace = Number.isFinite(requestedGrace) && requestedGrace > 0 ? requestedGrace : 15_000
  const shutdown = new AbortController()
  const { promise: finished, resolve: finish, reject: fail } = Promise.withResolvers<void>()
  let worker: OwnedProcess | undefined
  let apiPort: number | undefined
  let restarting: Promise<void> | undefined
  let closeControl: (() => void) | undefined

  function startWorker() {
    const entry = projectCliEntry(root)
    // Resolve the project's CLI again after each update. Keep the current
    // Bun flags so sources and dist packages resolve as in the original run.
    const executable = entry
      ? [bun, ...process.execArgv, entry]
      : compiled
        ? [process.execPath]
        : [process.execPath, ...process.execArgv, Bun.main]
    const token = crypto.randomUUID()
    const pinnedPort = apiPort
    const apiReady = Promise.withResolvers<number>()
    const child = spawnOwnedProcess([...executable, command, ...(options?.verbose ? ['--verbose'] : [])], {
      cwd: root,
      env: {
        ...process.env,
        PORT: configuredPort === undefined ? undefined : String(configuredPort),
        ...(pinnedPort !== undefined && { PORT: String(pinnedPort) }),
        STACKS_SERVE_WORKER: '1',
        STACKS_SERVE_READY_TOKEN: web ? token : undefined,
      },
      ownerRuntime: bun,
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
      stopGraceMs: grace,
      ipc(message) {
        if (!web && message && typeof message === 'object' && 'type' in message && message.type === 'stacks:api-ready'
          && 'port' in message && typeof message.port === 'number' && Number.isInteger(message.port)
          && message.port > 0 && message.port <= 65535) {
          apiPort ??= message.port
          apiReady.resolve(message.port)
        }
      },
    })
    worker = child
    void child.exited.then(({ code }) => {
      if (shutdown.signal.aborted || restarting)
        return
      if (code)
        fail(new Error(`Buddy ${command} exited with status ${code}.`))
      else
        finish()
    }, (error: unknown) => {
      if (!shutdown.signal.aborted && !restarting)
        fail(error)
    })
    return { child, token, apiReady: apiReady.promise, pinnedPort }
  }

  async function restart(): Promise<void> {
    await worker?.stop()
    shutdown.signal.throwIfAborted()
    const { child, token, apiReady, pinnedPort } = startWorker()
    const wait = new AbortController()
    const signal = AbortSignal.any([wait.signal, shutdown.signal, AbortSignal.timeout(90_000)])
    const timeout = new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error(`Buddy ${command} did not come back after restarting.`)), { once: true })
    })
    try {
      const port = await Promise.race([
        child.started.then(() => web ? waitForWebServer(process.env.HOST?.trim(), webPort, token, signal) : apiReady),
        child.exited.then(({ code }) => { throw new Error(`Buddy ${command} exited before it was ready (status ${code}).`) }),
        timeout,
      ])
      if (pinnedPort !== undefined && port !== pinnedPort)
        throw new Error(`Buddy ${command} came back on port ${port} instead of ${pinnedPort}.`)
    }
    finally {
      wait.abort()
    }
  }

  const stop = () => {
    shutdown.abort()
    closeControl?.()
    void worker?.stop().then(finish, fail)
  }
  const signals = ['SIGINT', 'SIGTERM'] as const
  for (const signal of signals)
    process.on(signal, stop)
  try {
    startWorker()
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
    for (const signal of signals)
      process.off(signal, stop)
    await worker?.stop()
  }
}
