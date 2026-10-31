import type { DesktopAgent } from '../src/agent'
import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hasSessionCookie, isAgentHost, rememberedPort, sessionCookie, startDesktopAgent } from '../src/agent'
import {
  acquireInstanceLock,
  agentHostCommand,
  desktopAgentPaths,
  findAgentManifest,
  readAgentManifest,
  releaseInstanceLock,
  renderAgentEntry,
  runDesktopAgentApp,
} from '../src/agent-launcher'

/**
 * The agent is the only thing standing between a web page and the app's API
 * on 127.0.0.1. These run a real server and send it what a hostile page, a
 * stale cookie and the host itself would send.
 */

const agents: DesktopAgent[] = []
const scratch: string[] = []
afterEach(() => {
  for (const agent of agents.splice(0)) agent.stop()
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-agent-'))
  scratch.push(dir)
  return dir
}

async function agent(options: Partial<Parameters<typeof startDesktopAgent>[0]> = {}): Promise<DesktopAgent> {
  const started = await startDesktopAgent({ port: 0, handler: request => Response.json({ path: new URL(request.url).pathname }), ...options })
  agents.push(started)
  return started
}

/** fetch() sets Host from the URL; a rebinding page's Host is its own name, which this lets a test send. */
function get(agent: DesktopAgent, path: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${agent.url}${path}`, { headers })
}

function cookieFrom(response: Response): string {
  return (response.headers.get('set-cookie') ?? '').split(';')[0]!
}

describe('the session handshake', () => {
  test('/native/session issues an HttpOnly, SameSite=Strict cookie holding the run token', async () => {
    const running = await agent({ name: 'Browser', version: '1.0.0' })
    const response = await get(running, '/native/session')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ name: 'Browser', version: '1.0.0', renderer: 'appkit' })
    const header = response.headers.get('set-cookie')!
    expect(header).toContain(`stacks_desktop=${running.token}`)
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Strict')
  })

  test('a page that rebinds its own name to 127.0.0.1 gets no session', async () => {
    const running = await agent()
    const response = await get(running, '/native/session', { host: `evil.example:${running.port}` })
    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  test('the session cannot be fetched with anything but GET', async () => {
    const running = await agent()
    expect((await fetch(`${running.url}/native/session`, { method: 'POST' })).status).toBe(405)
  })
})

describe('the API', () => {
  test('refuses a request without the cookie', async () => {
    const running = await agent()
    expect((await get(running, '/api/history')).status).toBe(403)
  })

  test('answers with the cookie, through the app handler', async () => {
    const running = await agent()
    const cookie = cookieFrom(await get(running, '/native/session'))
    const response = await get(running, '/api/history', { cookie })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ path: '/api/history' })
  })

  test('refuses the right cookie under the wrong Host', async () => {
    const running = await agent()
    const cookie = cookieFrom(await get(running, '/native/session'))
    expect((await get(running, '/api/history', { cookie, host: `evil.example:${running.port}` })).status).toBe(403)
    // Another loopback spelling is still not this agent's origin.
    expect((await get(running, '/api/history', { cookie, host: `[::1]:${running.port}` })).status).toBe(403)
    expect((await get(running, '/api/history', { cookie, host: `localhost:${running.port}` })).status).toBe(200)
  })

  test('routes outside /api need the session too', async () => {
    const running = await agent()
    expect((await get(running, '/v1/settings')).status).toBe(403)
  })

  test('a handler that throws answers 500 rather than dropping the connection', async () => {
    const running = await agent({ handler: () => { throw new Error('boom') } })
    const cookie = cookieFrom(await get(running, '/native/session'))
    const response = await get(running, '/api/x', { cookie })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'boom' })
  })
})

describe('token rotation', () => {
  test('a rotated token voids every cookie issued before it', async () => {
    const running = await agent()
    const before = cookieFrom(await get(running, '/native/session'))
    const old = running.token
    expect(running.rotateToken()).not.toBe(old)
    expect((await get(running, '/api/x', { cookie: before })).status).toBe(403)
    const after = cookieFrom(await get(running, '/native/session'))
    expect((await get(running, '/api/x', { cookie: after })).status).toBe(200)
  })

  test('every launch mints its own token, so a cookie from the last run is worthless', async () => {
    const first = await agent()
    const cookie = cookieFrom(await get(first, '/native/session'))
    const port = first.port
    first.stop()
    agents.splice(agents.indexOf(first), 1)
    const second = await agent({ port })
    expect(second.token).not.toBe(first.token)
    expect((await get(second, '/api/x', { cookie })).status).toBe(403)
  })
})

describe('the port', () => {
  test('is remembered, so the origin is the same next launch', async () => {
    const portFile = join(tempDir(), 'agent.port')
    const first = await agent({ port: undefined, portFile })
    expect(readFileSync(portFile, 'utf8')).toBe(String(first.port))
    const port = first.port
    first.stop()
    agents.splice(agents.indexOf(first), 1)
    const second = await agent({ port: undefined, portFile })
    expect(second.port).toBe(port)
  })

  test('falls back to any free port when the remembered one is taken', async () => {
    const holder = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('taken') })
    try {
      const portFile = join(tempDir(), 'agent.port')
      writeFileSync(portFile, String(holder.port))
      const running = await agent({ port: undefined, portFile })
      expect(running.port).not.toBe(holder.port)
      expect(readFileSync(portFile, 'utf8')).toBe(String(running.port))
    }
    finally {
      holder.stop(true)
    }
  })

  test('ignores a remembered value that is not a usable port', () => {
    const dir = tempDir()
    for (const value of ['', 'abc', '80', '70000', '3000.5']) {
      writeFileSync(join(dir, 'p'), value)
      expect(rememberedPort(join(dir, 'p'))).toBe(0)
    }
    expect(rememberedPort(join(dir, 'missing'))).toBe(0)
    expect(rememberedPort(undefined)).toBe(0)
  })
})

describe('static files', () => {
  test('a page is served without a session and hands one out', async () => {
    const web = tempDir()
    writeFileSync(join(web, 'index.html'), '<h1>hi</h1>')
    const running = await agent({ staticDir: web })
    const response = await get(running, '/')
    expect(await response.text()).toBe('<h1>hi</h1>')
    expect(response.headers.get('set-cookie')).toContain(`stacks_desktop=${running.token}`)
  })

  test('never leaves the directory', async () => {
    const root = tempDir()
    mkdirSync(join(root, 'web'))
    writeFileSync(join(root, 'secret.txt'), 'secret')
    const running = await agent({ staticDir: join(root, 'web') })
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt'])
      expect(await (await get(running, path)).text()).not.toBe('secret')
  })
})

describe('helpers', () => {
  test('isAgentHost accepts only 127.0.0.1 and localhost on the agent port', () => {
    expect(isAgentHost('127.0.0.1:4000', 4000)).toBe(true)
    expect(isAgentHost('localhost:4000', 4000)).toBe(true)
    expect(isAgentHost('127.0.0.1:4001', 4000)).toBe(false)
    expect(isAgentHost('127.0.0.1', 4000)).toBe(false)
    expect(isAgentHost(null, 4000)).toBe(false)
  })

  test('hasSessionCookie matches the whole cookie, not a prefix', () => {
    const request = (cookie: string) => new Request('http://127.0.0.1/', { headers: { cookie } })
    expect(hasSessionCookie(request('a=1; stacks_desktop=abc'), 'stacks_desktop', 'abc')).toBe(true)
    expect(hasSessionCookie(request('stacks_desktop=abcd'), 'stacks_desktop', 'abc')).toBe(false)
    expect(hasSessionCookie(request('xstacks_desktop=abc'), 'stacks_desktop', 'abc')).toBe(false)
    expect(sessionCookie('n', 't')).toBe('n=t; Path=/; HttpOnly; SameSite=Strict')
  })
})

describe('the launcher', () => {
  test('keeps the app to one copy, and takes over a lock left by a crash', () => {
    const lock = join(tempDir(), 'agent.pid')
    expect(acquireInstanceLock(lock, process.pid)).toBe(true)
    // Another live process (this one, seen from a second launch) holds it.
    expect(acquireInstanceLock(lock, process.pid + 1_000_000)).toBe(false)
    // A pid that is not running is a crash's leftover.
    writeFileSync(lock, '2147483646')
    expect(acquireInstanceLock(lock, process.pid)).toBe(true)
    releaseInstanceLock(lock, process.pid + 1)
    expect(existsSync(lock)).toBe(true)
    releaseInstanceLock(lock, process.pid)
    expect(existsSync(lock)).toBe(false)
  })

  test('keeps its data, lock and log where an update cannot replace them', () => {
    expect(desktopAgentPaths('Browser', '/Users/me')).toEqual({
      dataDir: '/Users/me/Library/Application Support/Browser',
      portFile: '/Users/me/Library/Application Support/Browser/agent.port',
      lockFile: '/Users/me/Library/Application Support/Browser/agent.pid',
      logFile: '/Users/me/Library/Logs/Browser.log',
    })
  })

  test('finds the bundled manifest in Contents/Resources, and resolves its paths there', () => {
    const app = tempDir()
    mkdirSync(join(app, 'Contents/MacOS'), { recursive: true })
    mkdirSync(join(app, 'Contents/Resources'), { recursive: true })
    writeFileSync(join(app, 'Contents/Resources/desktop-agent.json'), JSON.stringify({ appName: 'B', bundleId: 'a.b', version: '1', host: '../MacOS/craft-runtime', nativeBundle: 'native-screen.js', hostArguments: [], appRoutes: false }))
    const file = findAgentManifest(join(app, 'Contents/MacOS/B'), {})
    expect(file).toBe(join(app, 'Contents/Resources/desktop-agent.json'))
    const manifest = readAgentManifest(file!)
    expect(manifest.host).toBe(join(app, 'Contents/MacOS/craft-runtime'))
    expect(manifest.nativeBundle).toBe(join(app, 'Contents/Resources/native-screen.js'))
    expect(findAgentManifest('/nowhere/bin', { STACKS_DESKTOP_AGENT_MANIFEST: '/tmp/m.json' })).toBe('/tmp/m.json')
    expect(findAgentManifest('/nowhere/bin', {})).toBeNull()
  })

  test('points the host at the agent and the screens before its window flags', () => {
    expect(agentHostCommand({ host: '/h', nativeBundle: '/s.js', hostArguments: ['--title', 'B'] }, 'http://127.0.0.1:5000'))
      .toEqual(['/h', '--api-url', 'http://127.0.0.1:5000', '--native-bundle', '/s.js', '--title', 'B'])
  })

  test('the generated entry names the agent routes by absolute path, so the bundler follows them', () => {
    const source = renderAgentEntry({ agentEntry: '/app/app/Desktop/Agent.ts', launcherModule: '/fw/agent-launcher.ts' })
    expect(source).toContain('from "/fw/agent-launcher.ts"')
    expect(source).toContain('import("/app/app/Desktop/Agent.ts")')
    expect(renderAgentEntry({ launcherModule: '/fw/agent-launcher.ts' })).toContain('entry: undefined')
  })

  test('runs the agent for as long as the host runs, then lets go of the lock and the port', async () => {
    const dir = tempDir()
    for (const file of ['host', 'screens.js']) writeFileSync(join(dir, file), '')
    const paths = { dataDir: dir, portFile: join(dir, 'agent.port'), lockFile: join(dir, 'agent.pid'), logFile: join(dir, 'app.log') }
    let command: string[] = []
    let status = 0
    const code = await runDesktopAgentApp({
      manifest: { appName: 'Browser', bundleId: 'a.b', version: '1.0.0', host: join(dir, 'host'), nativeBundle: join(dir, 'screens.js'), hostArguments: ['--title', 'Browser'], appRoutes: false },
      handler: async () => () => new Response('ok'),
      paths,
      logWhenDetached: false,
      // The host's first act, as Craft's is: ask for the session, then call the API with it.
      spawn: (args) => {
        command = args
        const url = args[args.indexOf('--api-url') + 1]!
        const exited = (async () => {
          const session = await fetch(`${url}/native/session`)
          status = (await fetch(`${url}/api/ping`, { headers: { cookie: cookieFrom(session) } })).status
          return 0
        })()
        return { exited, kill: () => {} }
      },
    })
    expect(code).toBe(0)
    expect(status).toBe(200)
    expect(command.slice(0, 2)).toEqual([join(dir, 'host'), '--api-url'])
    expect(command).toContain('--native-bundle')
    expect(existsSync(paths.lockFile)).toBe(false)
    const port = Number(readFileSync(paths.portFile, 'utf8'))
    await expect(fetch(`http://127.0.0.1:${port}/native/session`)).rejects.toThrow()
  })

  test('a second launch exits at once and leaves the first one alone', async () => {
    const dir = tempDir()
    const paths = { dataDir: dir, portFile: join(dir, 'agent.port'), lockFile: join(dir, 'agent.pid'), logFile: join(dir, 'app.log') }
    writeFileSync(paths.lockFile, String(process.ppid))
    let booted = false
    const code = await runDesktopAgentApp({
      manifest: { appName: 'Browser', bundleId: 'a.b', version: '1', host: '/h', nativeBundle: '/s', hostArguments: [], appRoutes: false },
      handler: async () => { booted = true; return () => new Response('') },
      paths,
      logWhenDetached: false,
    })
    expect(code).toBe(0)
    expect(booted).toBe(false)
    expect(readFileSync(paths.lockFile, 'utf8')).toBe(String(process.ppid))
  })
})
