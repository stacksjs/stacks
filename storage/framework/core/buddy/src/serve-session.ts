import type { OwnedProcess } from '@stacksjs/cli/owned-process'
import process from 'node:process'
import { resolveApiHost } from '@stacksjs/actions/helpers/api-host'
import { serveAppRestart } from '@stacksjs/actions/dev/app-session-control'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { log } from '@stacksjs/logging'
import { isCompiledBinary, projectCliEntry, projectPath } from '@stacksjs/path'
import { serveReadyHeader, serveReadyPath } from './serve-readiness'
import { createServeRelay } from './serve-relay'

type ServeCommand = 'serve' | 'serve:api'
interface ServeOptions { port?: string | number, verbose?: boolean }
type Relay = ReturnType<typeof createServeRelay>
interface ServeWorker {
  child: OwnedProcess
  token: string
  apiReady: Promise<number>
  privatePort?: number
  target?: ReturnType<Relay['createTarget']>
}

async function reserveWorkerPort(): Promise<number> {
  const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
  const port = reservation.port!
  await reservation.stop(true)
  return port
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

async function waitForWebServer(pid: number, host: string | undefined, port: number, token: string, signal: AbortSignal, sharedPort: boolean): Promise<number> {
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
    if (sharedPort && process.platform === 'darwin' && await ownsMacListener(pid, port, signal))
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
  const relayEnabled = process.platform === 'win32' || process.env.STACKS_SERVE_TCP_RELAY === '1'
  if (relayEnabled)
    process.env.APP_ENV ||= 'production'
  const publicHost = web ? (process.env.HOST?.trim() || '0.0.0.0') : resolveApiHost({
    ...process.env,
    APP_ENV: process.env.APP_ENV || 'production',
  })
  const publicPort = relayEnabled ? await servingPort(configuredPort, web) : undefined
  const relay = publicPort === undefined ? undefined : createServeRelay(publicHost, publicPort)
  const requestedGrace = Number(process.env.SHUTDOWN_GRACE_MS)
  const grace = Number.isFinite(requestedGrace) && requestedGrace > 0 ? requestedGrace : 15_000
  const shutdown = new AbortController()
  const { promise: finished, resolve: finish, reject: fail } = Promise.withResolvers<void>()
  const children = new Set<OwnedProcess>()
  void finished.catch(() => {})
  let worker: ServeWorker | undefined
  let apiPort: number | undefined
  let restarting: Promise<void> | undefined
  let closeControl: (() => void) | undefined

  async function startWorker(pinnedPort?: number): Promise<ServeWorker> {
    const privatePort = relay ? await reserveWorkerPort() : undefined
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
    let target: ServeWorker['target']
    const child = spawnOwnedProcess([...executable, command, ...(options?.verbose ? ['--verbose'] : [])], {
      cwd: root,
      env: {
        ...process.env,
        PORT: configuredPort === undefined ? undefined : String(configuredPort),
        ...(pinnedPort !== undefined && { PORT: String(pinnedPort) }),
        STACKS_SERVE_WORKER: '1',
        STACKS_SERVE_RELAY_PORT: privatePort === undefined ? undefined : String(privatePort),
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
    if (privatePort !== undefined)
      target = relay!.createTarget(privatePort, child.send)
    children.add(child)
    void child.exited.then(({ code }) => {
      target?.close()
      children.delete(child)
      if (shutdown.signal.aborted || worker?.child !== child)
        return
      if (code)
        fail(new Error(`Buddy ${command} exited with status ${code}.`))
      else
        finish()
    }, (error: unknown) => {
      target?.close()
      if (!shutdown.signal.aborted && worker?.child === child)
        fail(error)
    })
    return { child, token, apiReady: apiReady.promise, privatePort, target }
  }

  async function waitForWorker({ child, token, apiReady, privatePort }: ServeWorker): Promise<number> {
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
        child.started.then(pid => web
          ? waitForWebServer(pid, privatePort === undefined ? publicHost : '127.0.0.1', privatePort ?? webPort, token, signal, privatePort === undefined)
          : apiReady),
        child.exited.then(({ code }) => { throw new Error(`Buddy ${command} exited before it was ready (status ${code}).`) }),
        timeout,
      ])
    }
    finally {
      wait.abort()
    }
  }

  async function ready(instance: ServeWorker, expectedPort?: number): Promise<void> {
    const port = await waitForWorker(instance)
    if (expectedPort !== undefined && port !== expectedPort)
      throw new Error(`Buddy ${command} listened on port ${port} instead of ${expectedPort}.`)
  }

  async function retire(previous: ServeWorker): Promise<void> {
    if (previous.target) {
      const deadline = Date.now() + grace
      await previous.target.drain(grace)
      previous.child.send({ type: 'stacks:serve-drain' })
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          previous.child.exited,
          new Promise<void>(resolve => { timer = setTimeout(resolve, Math.max(deadline - Date.now(), 250)) }),
        ])
      }
      finally {
        clearTimeout(timer)
        previous.target.close()
        await previous.child.stop()
      }
    }
    else {
      await previous.child.stop()
    }
  }

  async function restart(): Promise<void> {
    const previous = worker!
    // A direct API listener may get its port from project configuration.
    if (!web && !relay)
      apiPort ??= await waitForWorker(previous)
    shutdown.signal.throwIfAborted()
    const candidate = await startWorker(apiPort)
    try {
      await ready(candidate, candidate.privatePort ?? apiPort)
      shutdown.signal.throwIfAborted()
      if (candidate.target)
        relay!.promote(candidate.target)
      worker = candidate
    }
    catch (error) {
      await candidate.child.stop()
      throw error
    }
    await retire(previous)
  }

  const stopChildren = () => Promise.all([...children].map(child => child.stop()))
  const stop = () => {
    shutdown.abort()
    closeControl?.()
    relay?.stop()
    void stopChildren().then(() => finish(), fail)
  }
  const signals = ['SIGINT', 'SIGTERM'] as const
  for (const signal of signals)
    process.on(signal, stop)
  try {
    await relay?.listening
    worker = await startWorker()
    if (worker.target) {
      await ready(worker, worker.privatePort)
      relay!.promote(worker.target)
      log.info(`Buddy ${command} is listening on port ${publicPort}.`)
    }
    else if (!web) {
      void worker.apiReady.then((port) => { apiPort ??= port })
    }
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
    relay?.stop()
    for (const signal of signals)
      process.off(signal, stop)
    await stopChildren()
  }
}
