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

async function ownsMacListener(pid: number, port: number, signal: AbortSignal): Promise<boolean> {
  try {
    const probe = Bun.spawn(['/usr/sbin/lsof', '-nP', '-a', '-p', String(pid), `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
      stdout: 'pipe',
      stderr: 'ignore',
      signal,
    })
    const [code, output] = await Promise.all([probe.exited, new Response(probe.stdout).text()])
    return code === 0 && output.trim() === String(pid)
  }
  catch {
    return false
  }
}

async function waitForWebServer(pid: number, host: string | undefined, port: number, token: string, signal: AbortSignal): Promise<number> {
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

    // macOS can send every request on a shared port to the old listener.
    // STX binds after installing its request handler. Check the owned
    // replacement PID for that listening socket when HTTP hits the old one.
    if (process.platform === 'darwin' && await ownsMacListener(pid, port, signal))
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
  const children = new Set<OwnedProcess>()
  let worker: ReturnType<typeof startWorker> | undefined
  let apiPort: number | undefined
  let restarting: Promise<void> | undefined
  let closeControl: (() => void) | undefined

  function startWorker(pinnedPort?: number) {
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
          apiReady.resolve(message.port)
        }
      },
    })
    children.add(child)
    void child.exited.then(({ code }) => {
      children.delete(child)
      if (shutdown.signal.aborted || worker?.child !== child)
        return
      if (code)
        fail(new Error(`Buddy ${command} exited with status ${code}.`))
      else
        finish()
    }, (error: unknown) => {
      if (!shutdown.signal.aborted && worker?.child === child)
        fail(error)
    })
    return { child, token, apiReady: apiReady.promise }
  }

  async function waitForWorker({ child, token, apiReady }: ReturnType<typeof startWorker>): Promise<number> {
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
      return await Promise.race([
        child.started.then(pid => web ? waitForWebServer(pid, process.env.HOST?.trim(), webPort, token, signal) : apiReady),
        child.exited.then(({ code }) => { throw new Error(`Buddy ${command} exited before it was ready (status ${code}).`) }),
        timeout,
      ])
    }
    finally {
      wait.abort()
    }
  }

  async function restart(): Promise<void> {
    // The Windows process owner terminates its Job Object without a drain.
    if (process.platform === 'win32')
      throw new Error('Buddy cannot drain served workers on Windows. The current server is still running.')
    const previous = worker!
    // Resolve the API's configured port from its first worker if a restart
    // was requested before the initial ready message arrived.
    if (!web)
      apiPort ??= await waitForWorker(previous)
    shutdown.signal.throwIfAborted()
    const candidate = startWorker(apiPort)
    try {
      const port = await waitForWorker(candidate)
      if (apiPort !== undefined && port !== apiPort)
        throw new Error(`Buddy ${command} came back on port ${port} instead of ${apiPort}.`)
      shutdown.signal.throwIfAborted()
      worker = candidate
    }
    catch (error) {
      await candidate.child.stop()
      throw error
    }
    await previous.child.stop()
  }

  const stopChildren = () => Promise.all([...children].map(child => child.stop()))
  const stop = () => {
    shutdown.abort()
    closeControl?.()
    void stopChildren().then(() => finish(), fail)
  }
  const signals = ['SIGINT', 'SIGTERM'] as const
  for (const signal of signals)
    process.on(signal, stop)
  try {
    worker = startWorker()
    if (!web)
      void worker.apiReady.then((port) => { apiPort ??= port })
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
    await stopChildren()
  }
}
