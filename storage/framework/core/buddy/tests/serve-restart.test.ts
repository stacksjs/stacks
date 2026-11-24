import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { isProcessAlive } from '@stacksjs/path'
import { restartAppSession, runningAppSessions } from '../../actions/src/dev/app-session-control'
import { canRestartUpdatedProject, restartUpdatedProject } from '../../actions/src/dev/dashboard-restart'

async function freePort(): Promise<number> {
  const listener = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
  const port = listener.port!
  await listener.stop(true)
  return port
}

async function waitForBody(url: string): Promise<string> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const response = await fetch(url, { signal: AbortSignal.timeout(750) }).catch(() => null)
    if (response?.ok)
      return response.text()
    await Bun.sleep(100)
  }
  throw new Error(`No successful response from ${url}`)
}

async function holdUntil(file: string): Promise<void> {
  const deadline = Date.now() + 10_000
  while (!await Bun.file(file).exists()) {
    if (Date.now() >= deadline)
      throw new Error(`Timed out waiting for ${file}`)
    await Bun.sleep(25)
  }
}

async function sampleTraffic(urls: string[], signal: AbortSignal): Promise<{ failures: string[], responses: number }> {
  const failures: string[] = []
  let responses = 0
  while (!signal.aborted) {
    await Promise.all(urls.map(async (url) => {
      try {
        const response = await fetch(url, { headers: { connection: 'close' }, signal: AbortSignal.timeout(1500) })
        await response.text()
        if (!response.ok)
          failures.push(`${url} returned ${response.status}`)
        responses++
      }
      catch (error) {
        failures.push(`${url}: ${error}`)
      }
    }))
    await Bun.sleep(10)
  }
  return { failures, responses }
}

const modes = process.platform === 'win32' ? ['TCP relay'] : ['native listeners', 'TCP relay']

test.each(modes)('Software Update rolls web and API workers without interrupting traffic (%s)', async (mode) => {
  const usingRelay = mode === 'TCP relay'
  const root = await mkdtemp(join(tmpdir(), 'stacks-serve-restart-'))
  const children: Array<ReturnType<typeof Bun.spawn>> = []
  const framework = resolve(import.meta.dir, '../../../../..')
  const views = join(root, 'resources/views')
  const actions = join(root, 'storage/framework/core/actions/src/serve')
  const apiFile = join(actions, 'api.ts')
  const stx = join(root, 'serve-fixture.ts')
  const relayWorker = join(framework, 'storage/framework/core/actions/src/helpers/serve-relay-worker.ts')
  const versionedApi = (release: string) => `
import { installServeRelayWorker, serveRelayPort } from ${JSON.stringify(relayWorker)}
if ('${release}' === 'after') {
  await Bun.write('api-starting', '')
  while (!await Bun.file('start-api').exists())
    await Bun.sleep(25)
}
const relayPort = serveRelayPort()
const relay = relayPort ? installServeRelayWorker(drain) : undefined
const server = Bun.serve({
  hostname: relay ? '127.0.0.1' : process.env.API_HOST,
  port: relayPort ?? Number(process.env.PORT),
  reusePort: !relay && process.env.STACKS_SERVE_WORKER === '1',
  async fetch(request, server) {
    if (new URL(request.url).pathname === '/api/peer')
      return Response.json((relay?.wrap(server) ?? server).requestIP(request))
    if (new URL(request.url).pathname === '/api/slow') {
      await Bun.write('slow-api-started', '')
      while (!await Bun.file('finish-slow-api').exists())
        await Bun.sleep(25)
    }
    return new Response('${release} ' + process.pid)
  },
})
async function drain() {
  await Bun.write('api-draining', '')
  await server.stop()
  process.exit(0)
}
process.on('SIGTERM', drain)
process.send({ type: 'stacks:api-ready', port: server.port })
`
  try {
    await Promise.all([views, actions, ...['config', 'components', 'layouts', 'partials'].map(dir => join(root, dir))]
      .map(dir => mkdir(dir, { recursive: true })))
    const bunfig = join(root, 'bunfig.toml')
    await Promise.all([
      symlink(join(framework, 'node_modules'), join(root, 'node_modules'), 'junction'),
      writeFile(bunfig, 'preload = []\n'),
      writeFile(join(root, 'package.json'), '{"name":"serve-restart-fixture"}'),
      writeFile(join(root, 'config/app.ts'), "export default { key: 'test-serve-restart' }"),
      writeFile(join(views, 'worker.stx'), '<script server>const pid = process.pid</script>\n<h1>worker {{ pid }}</h1>\n'),
      writeFile(join(views, 'slow.stx'), `
<script server>
const pid = process.pid
await Bun.write('slow-web-started', '')
while (!await Bun.file('finish-slow-web').exists())
  await Bun.sleep(25)
</script>
<h1>worker {{ pid }}</h1>
`),
      writeFile(apiFile, versionedApi('before')),
      writeFile(stx, `
if (await Bun.file('fail-web').exists())
  throw new Error('Replacement web worker failed at startup')
export { serve } from 'bun-plugin-stx/serve'
`),
    ])
    const web = await freePort()
    let api = await freePort()
    while (api === web)
      api = await freePort()
    for (const [command, port] of [['serve', web], ['serve:api', api]]) {
      const entry = join(import.meta.dir, '../src/cli.ts')
      children.push(Bun.spawn([process.execPath, '--conditions=development', '--no-env-file', `--config=${bunfig}`, entry, String(command), '--port', String(port)], {
        cwd: root,
        env: {
          ...process.env,
          APP_ENV: 'test',
          STACKS_HOME: join(root, 'state'),
          DB_CONNECTION: 'sqlite',
          DB_DATABASE_PATH: ':memory:',
          HOST: '0.0.0.0',
          API_HOST: '127.0.0.1',
          BUN_PLUGIN_STX_SRC: stx,
          PORT_API: String(api),
          SHUTDOWN_GRACE_MS: '2500',
          STACKS_SERVE_TCP_RELAY: usingRelay ? '1' : undefined,
        },
        stdout: 'ignore',
        stderr: 'inherit',
      }))
    }
    const webUrl = `http://127.0.0.1:${web}`
    const [pageBefore, apiBefore] = await Promise.all([
      waitForBody(`${webUrl}/worker`),
      waitForBody(`http://127.0.0.1:${api}/api/fixture`),
    ])
    expect(canRestartUpdatedProject(root)).toBe(true)
    expect(runningAppSessions(root).map(session => session.pid).sort()).toEqual(children.map(child => child.pid).sort())
    expect(pageBefore).toMatch(/<h1>worker \d+<\/h1>/)
    expect(apiBefore).toMatch(/^before \d+$/)
    const apiUrl = `http://127.0.0.1:${api}`
    if (usingRelay) {
      // A network client cannot supply trusted peer metadata through HTTP.
      const peer = await new Promise<{ port: number, address: string, expectedPort?: number }>((resolve, reject) => {
        let response = ''
        const socket = createConnection({ host: '127.0.0.1', port: api })
        socket.setTimeout(3000, () => socket.destroy(new Error('Peer request timed out')))
        socket.once('error', reject)
        let expectedPort: number | undefined
        socket.once('connect', () => {
          expectedPort = socket.localPort
          socket.write('GET /api/peer HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nX-Forwarded-For: 192.0.2.1\r\n\r\n')
        })
        socket.on('data', chunk => { response += chunk })
        socket.once('end', () => {
          try { resolve({ ...JSON.parse(response.split('\r\n\r\n')[1]!), expectedPort }) }
          catch (error) { reject(error) }
        })
      })
      expect(peer.address).toBe('127.0.0.1')
      expect(peer.port).toBe(peer.expectedPort!)
    }
    const slow = fetch(`${apiUrl}/api/slow`, { signal: AbortSignal.timeout(12_000) }).then(response => response.text())
    const originalRequest = slow.catch(error => String(error))
    const originalWebRequest = fetch(`${webUrl}/slow`, { signal: AbortSignal.timeout(12_000) })
      .then(response => response.text()).catch(error => String(error))
    await Promise.all([holdUntil(join(root, 'slow-api-started')), holdUntil(join(root, 'slow-web-started'))])
    await writeFile(apiFile, versionedApi('after'))

    const monitor = new AbortController()
    const traffic = sampleTraffic([`${webUrl}/worker`, `${webUrl}/api/fixture`, `${apiUrl}/api/fixture`], monitor.signal)
    const restart = restartUpdatedProject(root)
    void restart.catch(() => {})
    try {
      await holdUntil(join(root, 'api-starting'))
      const stillServing = await fetch(`${apiUrl}/api/fixture`)
      expect(await stillServing.text()).toBe(apiBefore)
      expect(await Bun.file(join(root, 'api-draining')).exists()).toBe(false)
      await Bun.write(join(root, 'start-api'), '')
      if (!usingRelay)
        await holdUntil(join(root, 'api-draining'))
      await Bun.write(join(root, 'finish-slow-api'), '')
      expect(await originalRequest).toBe(apiBefore)
      const deadline = Date.now() + 5000
      let webResponse = pageBefore
      while (webResponse === pageBefore && Date.now() < deadline) {
        webResponse = await waitForBody(`${webUrl}/worker`)
        await Bun.sleep(25)
      }
      expect(webResponse).not.toBe(pageBefore)
      await Bun.write(join(root, 'finish-slow-web'), '')
      expect(await originalWebRequest).toContain(pageBefore.match(/<h1>worker \d+<\/h1>/)![0])
      await restart
    }
    finally {
      await Promise.all(['start-api', 'finish-slow-api', 'finish-slow-web'].map(file => Bun.write(join(root, file), '')))
      monitor.abort()
      await traffic
    }
    const duringRestart = await traffic
    expect(duringRestart.failures).toEqual([])
    expect(duringRestart.responses).toBeGreaterThan(10)

    const pageAfter = await waitForBody(`${webUrl}/worker`)
    const apiAfter = await waitForBody(`${webUrl}/api/fixture`)
    expect(pageAfter).toMatch(/<h1>worker \d+<\/h1>/)
    expect(pageAfter).not.toBe(pageBefore)
    expect(apiAfter).toMatch(/^after \d+$/)
    expect(isProcessAlive(Number(apiBefore.split(' ')[1]))).toBe(false)
    const unauthenticated = await fetch(`${webUrl}/__buddy/serve-ready`, { method: 'HEAD' })
    expect(unauthenticated.status).not.toBe(204)

    const sessions = runningAppSessions(root)
    const webSession = sessions.find(session => session.pid === children[0]!.pid)!
    const apiSession = sessions.find(session => session.pid === children[1]!.pid)!
    await Promise.all([
      Bun.write(join(root, 'fail-web'), ''),
      writeFile(apiFile, 'throw new Error("Replacement API failed at startup")'),
    ])
    const failures = await Promise.allSettled([restartAppSession(webSession), restartAppSession(apiSession)])
    expect(failures.map(result => result.status)).toEqual(['rejected', 'rejected'])
    expect(await (await fetch(`${webUrl}/worker`)).text()).toBe(pageAfter)
    expect(await (await fetch(`${webUrl}/api/fixture`)).text()).toBe(apiAfter)
  }
  finally {
    for (const child of children)
      child.kill('SIGTERM')
    const deadline = setTimeout(() => {
      for (const child of children)
        child.kill('SIGKILL')
    }, 4000)
    try {
      await Promise.all(children.map(child => child.exited))
      expect(runningAppSessions(root)).toEqual([])
    }
    finally {
      clearTimeout(deadline)
      await rm(root, { recursive: true, force: true })
    }
  }
}, 35_000)
