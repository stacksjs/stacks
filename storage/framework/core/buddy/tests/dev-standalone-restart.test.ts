import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isProcessAlive } from '@stacksjs/path'
import { startAppDevSession } from '../../actions/src/dev/app-session'
import { findRestartControl, restartAppSession, runningAppDevSessions } from '../../actions/src/dev/app-session-control'
import { restartUpdatedProject } from '../../actions/src/dev/dashboard-restart'

interface Listener {
  port: number
  pid: number
  version: string
  source: string
}

async function waitFor<T>(read: () => T | Promise<T>): Promise<T> {
  const deadline = Date.now() + 10_000
  for (;;) {
    try {
      return await read()
    }
    catch (error) {
      if (Date.now() >= deadline)
        throw error
      await Bun.sleep(50)
    }
  }
}

const launchModes = ['combined', 'separate commands', 'separate aliases'] as const

test.each(launchModes)('dev serves traffic through manual restarts and source reloads (%s)', async (mode) => {
  const combined = mode === 'combined'
  const commands = mode === 'separate aliases'
    ? [['dev:frontend'], ['dev:api', '--no-watch-types']]
    : [['dev', 'frontend'], ['dev', 'api']]
  const root = await mkdtemp(join(tmpdir(), 'stacks-standalone-dev-'))
  const actions = join(root, 'storage/framework/core/actions/src/dev')
  const sourceFile = join(root, 'config/source.ts')
  const frontendSource = join(root, 'resources/views/source.ts')
  const children: Array<ReturnType<typeof Bun.spawn>> = []
  let session: ReturnType<typeof startAppDevSession> | undefined
  const occupied = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('unrelated') })
  try {
    await Promise.all([mkdir(actions, { recursive: true }), mkdir(join(root, 'config')), mkdir(join(root, 'resources/views'), { recursive: true })])
    await Promise.all([
      writeFile(join(root, 'package.json'), '{"name":"standalone-restart-fixture"}'),
      writeFile(join(root, 'config/app.ts'), 'export default {}'),
      writeFile(join(root, 'bunfig.toml'), 'preload = []\n'),
      writeFile(join(root, 'version.txt'), 'before'),
      writeFile(sourceFile, 'export default "old source"'),
      writeFile(frontendSource, 'export default undefined'),
      ...(['views', 'api'] as const).map(name => writeFile(join(actions, `${name}.ts`), `
import sharedSource from '../../../../../../config/source'
${name === 'views' ? "import viewSource from '../../../../../../resources/views/source'" : 'const viewSource = undefined'}
const source = viewSource ?? sharedSource
const version = await Bun.file('version.txt').text()
const port = Number(process.env.STACKS_DEV_PUBLIC_PORT)
if (version === 'failed' && '${name}' === 'views')
  throw new Error('Replacement frontend failed at startup')
if ((version === 'after' || version === 'unstable') && '${name}' === 'api') {
  await Bun.write('hold-api', '')
  while (!await Bun.file('allow-api').exists())
    await Bun.sleep(25)
}
if (source === 'new source') {
  await Bun.write('source-started-${name}', '')
  while (!await Bun.file('source-release-${name}').exists())
    await Bun.sleep(25)
}
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.${name === 'api' ? 'PORT_API' : 'PORT'}),
  async fetch(request) {
    if (new URL(request.url).pathname === '/slow') {
      await Bun.write('slow-request', '')
      while (!await Bun.file('finish-slow').exists())
        await Bun.sleep(25)
    }
    if (version === 'unstable' && '${name}' === 'views')
      await Bun.write('standby-probed', '')
    if (source === 'new source')
      await Bun.write('source-probed-${name}', '')
    return Response.json({ port, pid: process.pid, version, source })
  },
})
${name === 'api' ? "process.send({ type: 'stacks:api-ready', port: server.port })" : ''}
await Bun.write('${name}-ready.txt', JSON.stringify({ port, pid: process.pid, version, source }))
if (version === 'unstable' && '${name}' === 'views') {
  while (!await Bun.file('exit-standby').exists())
    await Bun.sleep(25)
  process.exit(7)
}
`)),
    ])
    if (combined) {
      session = startAppDevSession({
        root,
        frontendPort: 0,
        apiPort: 0,
        async waitForPort(port, timeoutMs, signal) {
          const deadline = Date.now() + timeoutMs
          while (!signal.aborted && Date.now() < deadline) {
            const response = await fetch(`http://127.0.0.1:${port}`, {
              headers: { connection: 'close' },
              signal: AbortSignal.any([signal, AbortSignal.timeout(500)]),
            }).catch(() => null)
            if (response?.ok)
              return true
            await Bun.sleep(50)
          }
          return false
        },
        reportError: console.error,
      })
    }
    else {
      for (const args of commands) {
        children.push(Bun.spawn([process.execPath, '--no-env-file', join(import.meta.dir, 'fixtures/dev-defaults-preflight.ts'), ...args], {
          cwd: root,
          env: {
            ...process.env,
            PORT: String(occupied.port),
            PORT_API: '0',
            STACKS_HOME: join(root, '.state'),
            STACKS_DEV_NO_OPEN: '1',
            SHUTDOWN_GRACE_MS: '2500',
          },
          stdout: 'ignore',
          stderr: 'inherit',
        }))
      }
    }
    const [views, backend] = await Promise.all(['views', 'api'].map(name => waitFor(async () => {
      return await Bun.file(join(root, `${name}-ready.txt`)).json() as Listener
    })))
    const [frontend, api] = [views!, backend!]
    expect(runningAppDevSessions(root).map(session => session.pid).sort()).toEqual(
      combined ? [process.pid] : children.map(child => child.pid).sort(),
    )
    expect(frontend.port).not.toBe(occupied.port)

    async function read(port: number, path = '/'): Promise<Listener> {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { connection: 'close' },
        signal: AbortSignal.timeout(12_000),
      })
      expect(response.ok).toBe(true)
      return await response.json() as Listener
    }
    const before = await Promise.all([frontend.port, api.port].map(port => waitFor(() => read(port))))
    const slow = read(api.port, '/slow')
    void slow.catch(() => {})
    await waitFor(() => Bun.file(join(root, 'slow-request')).text())
    await writeFile(join(root, 'version.txt'), 'after')
    let monitoring = true
    const failures: unknown[] = []
    const traffic = (async () => {
      while (monitoring) {
        await Promise.all([frontend.port, api.port].map(port => read(port).catch(error => { failures.push(error) })))
        await Bun.sleep(10)
      }
    })()
    const restart = restartUpdatedProject(root)
    void restart.catch(() => {})
    try {
      await waitFor(() => Bun.file(join(root, 'hold-api')).text())
      expect(await read(api.port)).toEqual(api)
      if (combined) {
        await waitFor(async () => {
          const worker = await Bun.file(join(root, 'views-ready.txt')).json() as Listener
          if (worker.version !== 'after')
            throw new Error('Frontend replacement is not ready')
        })
        expect(await read(frontend.port)).toEqual(frontend)
      }
      await writeFile(join(root, 'allow-api'), '')
      await waitFor(async () => {
        if ((await read(api.port)).version !== 'after')
          throw new Error('API replacement is not serving')
      })
      await writeFile(join(root, 'finish-slow'), '')
      expect(await slow).toEqual(api)
      await restart

      const after = await Promise.all(before.map(async (previous) => {
        const current = await read(previous.port)
        expect(current).toMatchObject({ port: previous.port, version: 'after' })
        expect(current.pid).not.toBe(previous.pid)
        expect(isProcessAlive(previous.pid)).toBe(false)
        return current
      }))

      await writeFile(join(root, 'version.txt'), 'failed')
      const control = findRestartControl(root, 'dev', combined ? process.pid : children[0]!.pid)!
      await expect(restartAppSession(control)).rejects.toThrow('Frontend exited before it was ready')
      expect(await Promise.all(after.map(current => read(current.port)))).toEqual(after)

      if (combined) {
        await rm(join(root, 'allow-api'))
        await writeFile(join(root, 'version.txt'), 'unstable')
        const interrupted = restartAppSession(control)
        void interrupted.catch(() => {})
        await waitFor(() => Bun.file(join(root, 'standby-probed')).text())
        const standby = await Bun.file(join(root, 'views-ready.txt')).json() as Listener
        expect(standby.version).toBe('unstable')
        await writeFile(join(root, 'exit-standby'), '')
        await waitFor(() => {
          if (isProcessAlive(standby.pid))
            throw new Error('Frontend replacement has not exited')
        })
        await writeFile(join(root, 'allow-api'), '')
        await expect(interrupted).rejects.toThrow(/Frontend (stopped|exited)/)
        expect(await Promise.all(after.map(current => read(current.port)))).toEqual(after)
      }
    }
    finally {
      monitoring = false
      await traffic
    }
    expect(failures).toEqual([])

    await writeFile(join(root, 'version.txt'), 'after')
    await rm(join(root, 'slow-request'))
    await rm(join(root, 'finish-slow'))
    const beforeReload = await Promise.all([frontend.port, api.port].map(port => read(port)))
    const oldRequests = beforeReload.map(previous => read(previous.port, '/slow'))
    oldRequests.forEach(request => { void request.catch(() => {}) })
    await waitFor(() => Bun.file(join(root, 'slow-request')).text())
    monitoring = true
    const reloadTraffic = (async () => {
      while (monitoring) {
        await Promise.all(beforeReload.map(previous => read(previous.port).catch(error => { failures.push(error) })))
        await Bun.sleep(10)
      }
    })()
    function readReady(name: 'views' | 'api', source: string): Promise<Listener> {
      return waitFor(async () => {
        const worker = await Bun.file(join(root, `${name}-ready.txt`)).json() as Listener
        expect(worker.source).toBe(source)
        return worker
      })
    }
    try {
      await writeFile(sourceFile, 'export default "new source"')
      await Promise.all(['views', 'api'].map(name => waitFor(() => Bun.file(join(root, `source-started-${name}`)).text())))
      expect(await Promise.all(beforeReload.map(previous => read(previous.port)))).toEqual(beforeReload)
      await writeFile(join(root, 'source-release-views'), '')
      await readReady('views', 'new source')
      await waitFor(() => Bun.file(join(root, 'source-probed-views')).text())
      expect(await read(api.port)).toEqual(beforeReload[1]!)
      if (combined)
        expect(await read(frontend.port)).toEqual(beforeReload[0]!)
      await writeFile(join(root, 'source-release-api'), '')
      await Promise.all(beforeReload.map(previous => waitFor(async () => {
        const current = await read(previous.port)
        expect(current.source).toBe('new source')
        expect(current.pid).not.toBe(previous.pid)
      })))
      await writeFile(join(root, 'finish-slow'), '')
      expect(await Promise.all(oldRequests)).toEqual(beforeReload)

      const updated = await Promise.all(beforeReload.map(previous => read(previous.port)))
      await writeFile(frontendSource, 'await Bun.write("source-broken", ""); throw new Error("Invalid frontend edit"); export default undefined')
      await waitFor(() => Bun.file(join(root, 'source-broken')).text())
      expect(await Promise.all(updated.map(current => read(current.port)))).toEqual(updated)
      await writeFile(frontendSource, 'export default "fixed frontend source"')
      await waitFor(async () => {
        expect((await read(frontend.port)).source).toBe('fixed frontend source')
      })
      expect(await read(api.port)).toEqual(updated[1]!)
    }
    finally {
      monitoring = false
      await reloadTraffic
    }
    expect(failures).toEqual([])
    expect(await (await fetch(occupied.url)).text()).toBe('unrelated')
    for (const child of children)
      child.kill('SIGTERM')
    const exitCodes = await Promise.all(children.map(child => child.exited))
    if (process.platform !== 'win32')
      expect(exitCodes).toEqual(combined ? [] : [0, 0])
    await session?.stop()
    expect(runningAppDevSessions(root)).toEqual([])
  }
  finally {
    await session?.stop()
    for (const child of children)
      child.kill('SIGKILL')
    await Promise.all(children.map(child => child.exited))
    await occupied.stop(true)
    await rm(root, { recursive: true, force: true })
  }
}, 35_000)
