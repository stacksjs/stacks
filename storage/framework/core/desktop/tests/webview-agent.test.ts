import type { SecondInstanceLaunch, StxServe, WebviewAgent } from '../src/webview-agent'
import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { createWebviewGate, desktopAppPaths, INSTANCE_HEADER, INSTANCE_PATH, pickAgentPort, portIsFree, startWebviewAgent, widenedPath } from '../src/webview-agent'
import {
  acquireWebviewInstance,
  agentModuleOf,
  craftWindowCommand,
  forwardToInstance,
  parseLaunchArguments,
  publishInstancePort,
  releaseWebviewInstance,
  renderWebviewEntry,
  resolveWebviewRuntime,
  runWebviewApp,
} from '../src/webview-launcher'

const scratch: string[] = []
const agents: WebviewAgent[] = []
function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-webview-'))
  scratch.push(directory)
  return directory
}
afterEach(() => {
  for (const agent of agents.splice(0)) agent.stop()
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function views(): string {
  const directory = temporary()
  writeFileSync(join(directory, 'index.html'), '<h1>Home</h1>')
  mkdirSync(join(directory, 'assets'))
  writeFileSync(join(directory, 'assets', 'app.js'), 'console.log(1)')
  writeFileSync(join(directory, 'settings.html'), '<h1>Settings</h1>')
  return directory
}

async function started(options: Partial<Parameters<typeof startWebviewAgent>[0]> = {}): Promise<WebviewAgent> {
  const agent = await startWebviewAgent({ appName: 'Fixture', views: { kind: 'static', dir: views() }, ...options })
  agents.push(agent)
  return agent
}

/** Open the window's URL the way a web view does: follow the redirect by hand and keep the cookie. */
async function openWindow(agent: WebviewAgent, path?: string): Promise<{ cookie: string, location: string, setCookie: string }> {
  const response = await fetch(agent.launchUrl(path), { redirect: 'manual' })
  expect(response.status).toBe(302)
  const setCookie = response.headers.get('set-cookie') ?? ''
  return { cookie: setCookie.split(';')[0]!, location: response.headers.get('location') ?? '', setCookie }
}

describe('the one-time token', () => {
  test('is traded for an HttpOnly, SameSite=Strict cookie and a redirect without it', async () => {
    const agent = await started()
    const { cookie, location, setCookie } = await openWindow(agent, '/settings?tab=keys')
    expect(location).toBe('/settings?tab=keys')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    const page = await fetch(`${agent.origin}${location}`, { headers: { cookie } })
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('Settings')
  })

  test('works once', async () => {
    const agent = await started()
    const url = agent.launchUrl()
    expect((await fetch(url, { redirect: 'manual' })).status).toBe(302)
    const again = await fetch(url, { redirect: 'manual' })
    expect(again.status).toBe(401)
    expect(again.headers.get('set-cookie')).toBeNull()
  })

  test('is not the cookie: the URL a window was opened on does not open the API', async () => {
    const agent = await started({ handler: () => new Response('secret') })
    const token = new URL(agent.launchUrl()).searchParams.get('session')!
    const response = await fetch(`${agent.origin}/api/x`, { headers: { cookie: `stacks_desktop=${token}` } })
    expect(response.status).toBe(401)
  })

  test('a made-up token gets nothing', async () => {
    const agent = await started()
    const response = await fetch(`${agent.origin}/?session=${'0'.repeat(48)}`, { redirect: 'manual' })
    expect(response.status).toBe(401)
  })

  test('an unused token expires', () => {
    const realNow = Date.now
    try {
      const gate = createWebviewGate({ port: () => 4000 })
      const token = gate.mint()
      Date.now = () => realNow() + 61_000
      const decision = gate.check(new Request(`http://127.0.0.1:4000/?session=${token}`, { headers: { host: '127.0.0.1:4000' } }))
      expect('response' in decision && decision.response.status).toBe(401)
    }
    finally {
      Date.now = realNow
    }
  })
})

describe('who may call the agent', () => {
  test('a request without the cookie is refused, pages included', async () => {
    const agent = await started({ handler: () => new Response('secret') })
    expect((await fetch(`${agent.origin}/`)).status).toBe(401)
    expect((await fetch(`${agent.origin}/api/x`, { method: 'POST' })).status).toBe(401)
  })

  test('a Host header that is not the agent is refused even with the cookie', async () => {
    const agent = await started({ handler: () => new Response('secret') })
    const { cookie } = await openWindow(agent)
    for (const host of ['evil.example', `evil.example:${agent.port}`, `127.0.0.1:${agent.port + 1}`, `127.0.0.2:${agent.port}`]) {
      const response = await fetch(`${agent.origin}/api/x`, { headers: { cookie, host } })
      expect(response.status).toBe(403)
    }
    expect((await fetch(`${agent.origin}/api/x`, { headers: { cookie, host: `localhost:${agent.port}` } })).status).toBe(200)
  })

  test('a cookie from an earlier launch is worthless', async () => {
    const first = await started()
    const { cookie } = await openWindow(first)
    first.stop()
    const second = await started({ port: first.port })
    expect((await fetch(`${second.origin}/`, { headers: { cookie } })).status).toBe(401)
  })

  test('framework assets load without the cookie and never reach the handler', async () => {
    let seen = 0
    const agent = await started({ handler: () => { seen++ } })
    const asset = await fetch(`${agent.origin}/assets/app.js`)
    expect(asset.status).toBe(200)
    expect(seen).toBe(0)
    expect((await fetch(`${agent.origin}/assets/app.js`, { method: 'POST' })).status).toBe(401)
  })

  test('a public path reaches the handler without the cookie, and nothing else does', async () => {
    const agent = await started({ publicPaths: ['/mcp', '/hooks/'], handler: request => new URL(request.url).pathname === '/mcp' ? new Response('mcp') : undefined })
    expect(await (await fetch(`${agent.origin}/mcp`)).text()).toBe('mcp')
    // Public, but the app did not answer: the views are not shown to a stranger.
    expect((await fetch(`${agent.origin}/hooks/unknown`)).status).toBe(404)
    expect((await fetch(`${agent.origin}/mcpx`)).status).toBe(401)
  })
})

describe('request handling', () => {
  test('the handler answers first; what it leaves goes to the views', async () => {
    const agent = await started({
      handler: (request, context) => new URL(request.url).pathname === '/api/whoami' ? Response.json({ app: context.appName, origin: context.origin }) : undefined,
    })
    const { cookie } = await openWindow(agent)
    expect(await (await fetch(`${agent.origin}/api/whoami`, { headers: { cookie } })).json()).toEqual({ app: 'Fixture', origin: agent.origin })
    expect(await (await fetch(`${agent.origin}/`, { headers: { cookie } })).text()).toContain('Home')
    expect((await fetch(`${agent.origin}/missing`, { headers: { cookie } })).status).toBe(404)
  })

  test('a handler that throws is a 500, not a dead agent', async () => {
    const agent = await started({ handler: () => { throw new Error('boom') } })
    const { cookie } = await openWindow(agent)
    const response = await fetch(`${agent.origin}/api/x`, { headers: { cookie } })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'boom' })
  })

  test('windowReady resolves on the first authorized request', async () => {
    const agent = await started()
    let ready = false
    void agent.windowReady.then(() => { ready = true })
    await fetch(`${agent.origin}/`)
    await Bun.sleep(5)
    expect(ready).toBe(false)
    const { cookie } = await openWindow(agent)
    await fetch(`${agent.origin}/`, { headers: { cookie } })
    await Bun.sleep(5)
    expect(ready).toBe(true)
  })

  test('embedded views are served by request path', async () => {
    const directory = views()
    const agent = await started({ views: { kind: 'embedded', files: { '/index.html': join(directory, 'index.html'), '/settings.html': join(directory, 'settings.html') } } })
    const { cookie } = await openWindow(agent)
    expect(await (await fetch(`${agent.origin}/settings`, { headers: { cookie } })).text()).toContain('Settings')
    expect((await fetch(`${agent.origin}/`, { headers: { cookie } })).headers.get('cache-control')).toBe('no-store')
  })

  test('stx views are served through the same gate and handler', async () => {
    let stopped = false
    const serve: StxServe = async (options) => {
      const server = Bun.serve({
        hostname: '127.0.0.1',
        port: options.port,
        fetch: async request => (await options.onRequest(request, { stop: () => { stopped = true; return server.stop(true) } })) ?? new Response(`stx:${options.patterns[0]}`),
      })
    }
    const agent = await started({ views: { kind: 'stx', dir: '/project/resources/desktop', root: '/project', serve }, handler: request => new URL(request.url).pathname === '/api/x' ? new Response('api') : undefined })
    expect((await fetch(`${agent.origin}/`)).status).toBe(401)
    const { cookie } = await openWindow(agent)
    expect(await (await fetch(`${agent.origin}/`, { headers: { cookie } })).text()).toBe('stx:/project/resources/desktop')
    expect(await (await fetch(`${agent.origin}/api/x`, { headers: { cookie } })).text()).toBe('api')
    agent.stop()
    expect(stopped).toBe(true)
  })
})

describe('the port', () => {
  test('is remembered between launches', async () => {
    const portFile = join(temporary(), 'nested', 'agent.port')
    const first = await started({ portFile })
    expect(readFileSync(portFile, 'utf8')).toBe(String(first.port))
    first.stop()
    const second = await started({ portFile })
    expect(second.port).toBe(first.port)
  })

  test('falls back to a free one when the remembered port was taken, and remembers that', async () => {
    const portFile = join(temporary(), 'agent.port')
    const squatter = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('other') })
    try {
      writeFileSync(portFile, String(squatter.port))
      const agent = await started({ portFile })
      expect(agent.port).not.toBe(squatter.port)
      expect(readFileSync(portFile, 'utf8')).toBe(String(agent.port))
    }
    finally {
      squatter.stop(true)
    }
  })

  test('pickAgentPort keeps a free remembered port and replaces a taken one', () => {
    const portFile = join(temporary(), 'agent.port')
    const first = pickAgentPort({ portFile })
    expect(portIsFree(first)).toBe(true)
    expect(pickAgentPort({ portFile })).toBe(first)
    const squatter = Bun.serve({ hostname: '127.0.0.1', port: first, fetch: () => new Response('other') })
    try {
      expect(pickAgentPort({ portFile })).not.toBe(first)
    }
    finally {
      squatter.stop(true)
    }
  })

  test('a port file holding nonsense is ignored', async () => {
    const portFile = join(temporary(), 'agent.port')
    writeFileSync(portFile, '80; rm -rf')
    const agent = await started({ portFile })
    expect(agent.port).toBeGreaterThan(1024)
  })
})

describe('a second launch', () => {
  test('the lock is held by a live process and taken over from a dead one', () => {
    const lockFile = join(temporary(), 'agent.lock')
    const first = acquireWebviewInstance(lockFile, process.pid)
    expect(first.acquired).toBe(true)
    // Another live process asking.
    const second = acquireWebviewInstance(lockFile, process.ppid)
    expect(second.acquired).toBe(false)
    releaseWebviewInstance(lockFile, process.ppid)
    expect(existsSync(lockFile)).toBe(true)
    releaseWebviewInstance(lockFile, process.pid)
    expect(existsSync(lockFile)).toBe(false)

    // A pid that cannot be running.
    writeFileSync(lockFile, JSON.stringify({ pid: 2 ** 22 + 7, port: 1, secret: 'old' }))
    const taken = acquireWebviewInstance(lockFile, process.pid)
    expect(taken.acquired).toBe(true)
    expect(taken.acquired && taken.record.secret).not.toBe('old')
  })

  test('the lock file is readable by its owner only', () => {
    if (process.platform === 'win32') return
    const lockFile = join(temporary(), 'agent.lock')
    acquireWebviewInstance(lockFile)
    expect(Bun.file(lockFile).size).toBeGreaterThan(0)
    const { mode } = require('node:fs').statSync(lockFile) as { mode: number }
    expect(mode & 0o077).toBe(0)
  })

  test('its arguments and link reach the running instance', async () => {
    const lockFile = join(temporary(), 'agent.lock')
    const lock = acquireWebviewInstance(lockFile)
    if (!lock.acquired) throw new Error('lock')
    const received: SecondInstanceLaunch[] = []
    const agent = await started({ instanceSecret: lock.record.secret, onSecondInstance: (launch) => { received.push(launch) } })
    publishInstancePort(lockFile, lock.record, agent.port)

    const launch = { args: ['./my-app', '--verbose'], url: 'fixture://open/42', cwd: '/tmp' }
    expect(await forwardToInstance(lockFile, launch)).toBe(true)
    expect(received).toEqual([launch])
  })

  test('waits for an instance that is still starting', async () => {
    const lockFile = join(temporary(), 'agent.lock')
    const lock = acquireWebviewInstance(lockFile)
    if (!lock.acquired) throw new Error('lock')
    const received: SecondInstanceLaunch[] = []
    const forwarded = forwardToInstance(lockFile, { args: ['late'], cwd: '/' }, { delayMs: 10 })
    await Bun.sleep(40)
    const agent = await started({ instanceSecret: lock.record.secret, onSecondInstance: (launch) => { received.push(launch) } })
    publishInstancePort(lockFile, lock.record, agent.port)
    expect(await forwarded).toBe(true)
    expect(received[0]?.args).toEqual(['late'])
  })

  test('the instance door needs the secret from the lock file', async () => {
    const received: SecondInstanceLaunch[] = []
    const agent = await started({ instanceSecret: 'right-secret', onSecondInstance: (launch) => { received.push(launch) } })
    const post = (headers: Record<string, string>, body: unknown = { args: [], cwd: '/' }) => fetch(`${agent.origin}${INSTANCE_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
    expect((await post({})).status).toBe(403)
    expect((await post({ [INSTANCE_HEADER]: 'wrong-secret' })).status).toBe(403)
    // The window's cookie does not open it either: a page cannot fake a launch.
    const { cookie } = await openWindow(agent)
    expect((await post({ cookie })).status).toBe(403)
    expect((await post({ [INSTANCE_HEADER]: 'right-secret', host: 'evil.example' })).status).toBe(403)
    expect((await post({ [INSTANCE_HEADER]: 'right-secret' }, { args: 'not-a-list' })).status).toBe(400)
    expect(received).toEqual([])
    expect((await post({ [INSTANCE_HEADER]: 'right-secret' })).status).toBe(204)
    expect(received).toHaveLength(1)
  })

  test('there is no instance door when no secret was set', async () => {
    const agent = await started()
    const response = await fetch(`${agent.origin}${INSTANCE_PATH}`, { method: 'POST', headers: { [INSTANCE_HEADER]: '' }, body: '{}' })
    expect(response.status).toBe(403)
  })

  test('forwarding gives up when nothing holds the lock', async () => {
    expect(await forwardToInstance(join(temporary(), 'agent.lock'), { args: [], cwd: '/' })).toBe(false)
  })
})

describe('launch arguments', () => {
  test('a link in one of the app\'s schemes is the URL; the rest are the app\'s', () => {
    expect(parseLaunchArguments(['./project', 'Fettler://open?x=1', '--flag'], ['fettler'])).toEqual({ args: ['./project', '--flag'], url: 'Fettler://open?x=1' })
    expect(parseLaunchArguments(['https://example.com'], ['fettler'])).toEqual({ args: ['https://example.com'] })
    expect(parseLaunchArguments(['fettler://x'])).toEqual({ args: ['fettler://x'] })
  })

  test('the relaunch flag and Finder\'s serial number are not the app\'s arguments', () => {
    expect(parseLaunchArguments(['--wait-pid=4242', '-psn_0_12345', 'a'])).toEqual({ args: ['a'], waitPid: 4242 })
    expect(parseLaunchArguments(['--wait-pid=nope'])).toEqual({ args: [] })
  })
})

describe('the window', () => {
  const manifest = { appName: 'Fettler', appId: 'org.fettler.app', window: { title: 'Fettler', width: 1280, height: 800 }, runtimeFlags: ['--single-instance', '--deep-link', '--app-name'] }

  test('Craft is started on the agent URL with the app\'s identity', () => {
    const command = craftWindowCommand(manifest, '/app/craft-runtime', 'http://127.0.0.1:5000/?session=t')
    expect(command.slice(0, 3)).toEqual(['/app/craft-runtime', '--url', 'http://127.0.0.1:5000/?session=t'])
    expect(command).toContain('--no-devtools')
    expect(command.slice(command.indexOf('--single-instance'), command.indexOf('--single-instance') + 2)).toEqual(['--single-instance', 'org.fettler.app'])
    expect(command.slice(command.indexOf('--width'), command.indexOf('--width') + 4)).toEqual(['--width', '1280', '--height', '800'])
  })

  test('a launch\'s arguments and link ride along for Craft to forward', () => {
    const command = craftWindowCommand({ ...manifest, window: { ...manifest.window, devtools: true, darkMode: true, arguments: ['--frame-autosave', 'main'] } }, 'craft', 'about:blank', { args: ['a b', '--x'], url: 'fettler://open' })
    expect(command.join('\n')).toContain('--instance-arg\na b\n--instance-arg\n--x\n--deep-link\nfettler://open')
    expect(command).not.toContain('--no-devtools')
    expect(command).toContain('--dark')
    expect(command.slice(-2)).toEqual(['--frame-autosave', 'main'])
  })

  test('a runtime that does not know a flag is not given it', () => {
    const command = craftWindowCommand({ ...manifest, runtimeFlags: [] }, 'craft', 'http://127.0.0.1:5000/', { args: ['a'], url: 'fettler://open' })
    expect(command).toEqual(['craft', '--url', 'http://127.0.0.1:5000/', '--title', 'Fettler', '--width', '1280', '--height', '800', '--no-devtools'])
  })

  test('the runtime is beside the executable, or unpacked from it', () => {
    expect(resolveWebviewRuntime({ runtime: 'beside' }, { execPath: '/Applications/F.app/Contents/MacOS/F', dataDir: '/d', platform: 'darwin' })).toBe('/Applications/F.app/Contents/MacOS/craft-runtime')
    expect(resolveWebviewRuntime({ runtime: 'beside' }, { execPath: 'C:/F/F.exe', dataDir: '/d', platform: 'win32' })).toEndWith('craft-runtime.exe')
    expect(resolveWebviewRuntime({ runtime: '/abs/craft' }, { dataDir: '/d' })).toBe('/abs/craft')

    const directory = temporary()
    const embedded = join(directory, 'embedded-craft')
    writeFileSync(embedded, 'craft v1')
    const first = resolveWebviewRuntime({ runtime: 'embedded' }, { embedded, dataDir: directory, platform: 'linux' })
    expect(readFileSync(first, 'utf8')).toBe('craft v1')
    if (process.platform !== 'win32') expect((require('node:fs').statSync(first).mode as number) & 0o111).toBe(0o111)
    // A copy someone altered is put back.
    writeFileSync(first, 'tampered')
    expect(readFileSync(resolveWebviewRuntime({ runtime: 'embedded' }, { embedded, dataDir: directory, platform: 'linux' }), 'utf8')).toBe('craft v1')
    // A new runtime unpacks beside the old one.
    writeFileSync(embedded, 'craft v2')
    expect(resolveWebviewRuntime({ runtime: 'embedded' }, { embedded, dataDir: directory, platform: 'linux' })).not.toBe(first)
    expect(() => resolveWebviewRuntime({ runtime: 'embedded' }, { dataDir: directory })).toThrow('none was compiled in')
  })
})

describe('where an app keeps its files', () => {
  test('each platform\'s own place', () => {
    expect(desktopAppPaths('Fettler', { platform: 'darwin', home: '/Users/x', env: {} })).toMatchObject({ dataDir: '/Users/x/Library/Application Support/Fettler', logFile: '/Users/x/Library/Logs/Fettler.log' })
    expect(desktopAppPaths('My App', { platform: 'linux', home: '/home/x', env: {} })).toMatchObject({ dataDir: '/home/x/.local/share/my-app', logFile: '/home/x/.local/state/my-app/my-app.log' })
    expect(desktopAppPaths('My App', { platform: 'linux', home: '/home/x', env: { XDG_DATA_HOME: '/data', XDG_STATE_HOME: '/state' } })).toMatchObject({ dataDir: '/data/my-app', lockFile: '/data/my-app/agent.lock', logFile: '/state/my-app/my-app.log' })
    expect(desktopAppPaths('Fettler', { platform: 'win32', home: 'C:\\Users\\x', env: { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' } })).toMatchObject({ dataDir: 'C:\\Users\\x\\AppData\\Roaming\\Fettler', updatesDir: 'C:\\Users\\x\\AppData\\Roaming\\Fettler\\updates' })
  })
})

describe('PATH for an app started outside a terminal', () => {
  test('launchd\'s bare PATH gains where installers put tools, and keeps its own last', () => {
    const path = widenedPath({ platform: 'darwin', home: '/Users/x', env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' } }).split(':')
    expect(path.slice(0, 2)).toEqual(['/Users/x/.local/bin', '/Users/x/.bun/bin'])
    expect(path).toContain('/opt/homebrew/bin')
    expect(path).toContain('/usr/local/bin')
    expect(new Set(path).size).toBe(path.length)
  })

  test('a terminal\'s own entries survive', () => {
    const path = widenedPath({ platform: 'linux', home: '/home/x', env: { PATH: '/custom/bin:/usr/bin' } }).split(':')
    expect(path).toContain('/custom/bin')
    expect(path).toContain('/snap/bin')
    expect(path.indexOf('/home/x/.bun/bin')).toBeLessThan(path.indexOf('/custom/bin'))
  })

  test('Windows uses its own separator and the Path spelling', () => {
    const path = widenedPath({ platform: 'win32', home: 'C:\\Users\\x', env: { Path: 'C:\\Windows\\system32', LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' } }).split(';')
    expect(path[0]).toBe('C:\\Users\\x\\.bun\\bin')
    expect(path).toContain('C:\\Users\\x\\AppData\\Local\\Microsoft\\WinGet\\Links')
    expect(path.at(-1)).toBe('C:\\Windows\\system32')
  })
})

describe('the agent module', () => {
  test('a default-exported function is its fetch; an object is taken as written', () => {
    const handler = (): Response => new Response('x')
    expect(agentModuleOf({ default: handler }).fetch).toBe(handler)
    const module = { fetch: handler, secondInstance() {} }
    expect(agentModuleOf({ default: module })).toBe(module)
    expect(agentModuleOf(undefined)).toEqual({})
  })
})

describe('the entrypoint the build writes', () => {
  test('names the agent module, the manifest and every view statically', () => {
    const entry = renderWebviewEntry({
      manifest: { appName: 'F', appId: 'org.f.app', version: '0.1.0', runtime: 'embedded', window: { title: 'F', width: 1, height: 2 } },
      agentEntry: '/p/app/Desktop/Agent.ts',
      viewFiles: { '/index.html': '/p/dist/index.html', '/assets/a.js': '/p/dist/assets/a.js' },
      embeddedRuntime: '/craft/linux/craft',
      launcherModule: '@stacksjs/desktop-build',
    })
    expect(entry).toContain('import view0 from "/p/dist/index.html" with { type: \'file\' }')
    expect(entry).toContain('"/assets/a.js": view1,')
    expect(entry).toContain('import embeddedRuntime from "/craft/linux/craft" with { type: \'file\' }')
    expect(entry).toContain('module: () => import("/p/app/Desktop/Agent.ts")')
    expect(entry).toContain('"appId": "org.f.app"')
  })

  test('in development it serves the project\'s stx views instead', () => {
    const entry = renderWebviewEntry({ manifest: { appName: 'F', appId: 'org.f.app', version: '0.1.0', runtime: '/bin/craft', window: { title: 'F', width: 1, height: 2 } }, stxViews: { dir: '/p/resources/desktop', root: '/p' } })
    expect(entry).toContain('kind: \'stx\'')
    expect(entry).toContain('module: undefined')
  })
})

describe('runWebviewApp', () => {
  const manifest = { appName: 'Fixture', appId: 'org.example.fixture', version: '0.3.0', runtime: process.execPath, window: { title: 'Fixture', width: 800, height: 600 }, urlSchemes: ['fixture'], runtimeFlags: ['--single-instance', '--deep-link'] }

  function paths(): ReturnType<typeof desktopAppPaths> {
    return desktopAppPaths('Fixture', { platform: process.platform, home: temporary(), env: {} })
  }

  test('serves, opens the window on a tradeable URL, and ends when the window closes', async () => {
    const at = paths()
    let close!: (code: number) => void
    const commands: string[][] = []
    const events: string[] = []
    let agent!: WebviewAgent
    const run = runWebviewApp({
      manifest,
      views: { kind: 'static', dir: views() },
      paths: at,
      argv: ['./project'],
      logWhenDetached: false,
      module: async () => ({
        default: {
          fetch: (request: Request) => new URL(request.url).pathname === '/api/ping' ? new Response('pong') : undefined,
          start: (context: { launch: SecondInstanceLaunch }) => { events.push(`start:${context.launch.args.join(',')}`) },
          stop: () => { events.push('stop') },
        },
      }),
      onAgent: (started) => { agent = started },
      spawn: (command, env) => {
        commands.push(command)
        expect(env.CRAFT_RELAUNCH_EXECUTABLE).toBe(process.execPath)
        expect(env.CRAFT_RELAUNCH_ARGS).toContain(`--wait-pid=${process.pid}`)
        return { exited: new Promise<number>((resolve) => { close = resolve }), kill: () => {} }
      },
    })
    while (!commands.length) await Bun.sleep(5)
    const url = commands[0]![2]!
    const trade = await fetch(url, { redirect: 'manual' })
    expect(trade.status).toBe(302)
    const cookie = trade.headers.get('set-cookie')!.split(';')[0]!
    expect(await (await fetch(`${agent.origin}/api/ping`, { headers: { cookie } })).text()).toBe('pong')
    expect(JSON.parse(readFileSync(at.lockFile, 'utf8')).port).toBe(agent.port)
    expect(events).toEqual(['start:./project'])

    close(0)
    expect(await run).toBe(0)
    expect(events).toEqual(['start:./project', 'stop'])
    expect(existsSync(at.lockFile)).toBe(false)
    expect(fetch(`${agent.origin}/`)).rejects.toThrow()
  })

  test('a second launch hands over its arguments and link, raises the window, and boots nothing', async () => {
    const at = paths()
    let close!: (code: number) => void
    const received: SecondInstanceLaunch[] = []
    let opened = 0
    const first = runWebviewApp({
      manifest,
      views: { kind: 'none' },
      paths: at,
      argv: [],
      logWhenDetached: false,
      module: async () => ({ default: { secondInstance: (launch: SecondInstanceLaunch) => { received.push(launch) } } }),
      spawn: () => {
        opened++
        return { exited: new Promise<number>((resolve) => { close = resolve }), kill: () => {} }
      },
    })
    while (!opened) await Bun.sleep(5)

    // The second process: same lock, held by a live pid that is not ours.
    const record = JSON.parse(readFileSync(at.lockFile, 'utf8')) as { pid: number }
    writeFileSync(at.lockFile, JSON.stringify({ ...record, pid: process.ppid }))
    let booted = false
    const raised: string[][] = []
    const second = await runWebviewApp({
      manifest,
      views: { kind: 'none' },
      paths: at,
      argv: ['./other', 'fixture://open/7'],
      logWhenDetached: false,
      platform: 'linux',
      module: async () => { booted = true; return {} },
      spawn: (command) => {
        raised.push(command)
        return { exited: Promise.resolve(0), kill: () => {} }
      },
    })
    expect(second).toBe(0)
    expect(booted).toBe(false)
    expect(received).toEqual([{ args: ['./other'], url: 'fixture://open/7', cwd: process.cwd() }])
    expect(raised[0]).toContain('--single-instance')
    expect(raised[0]!.join(' ')).toContain('--instance-arg ./other --deep-link fixture://open/7')

    // An older runtime would open a second window if started, so it is not: the hand-over alone happens.
    const quiet: string[][] = []
    const spawnQuiet = (command: string[]) => { quiet.push(command); return { exited: Promise.resolve(0), kill: () => {} } }
    await runWebviewApp({ manifest: { ...manifest, runtimeFlags: [] }, views: { kind: 'none' }, paths: at, argv: ['again'], logWhenDetached: false, platform: 'linux', spawn: spawnQuiet })
    expect(received.at(-1)?.args).toEqual(['again'])
    // Craft on macOS does not hand over between processes: started there, it opened a blank second window.
    await runWebviewApp({ manifest, views: { kind: 'none' }, paths: at, argv: ['mac'], logWhenDetached: false, platform: 'darwin', spawn: spawnQuiet })
    expect(received.at(-1)?.args).toEqual(['mac'])
    expect(quiet).toEqual([])

    writeFileSync(at.lockFile, JSON.stringify(record))
    close(0)
    await first
  })

  test('a missing runtime is an error before anything is locked', async () => {
    const at = paths()
    const code = await runWebviewApp({ manifest: { ...manifest, runtime: '/nowhere/craft' }, views: { kind: 'none' }, paths: at, argv: [], logWhenDetached: false })
    expect(code).toBe(1)
    expect(existsSync(at.lockFile)).toBe(false)
  })

  test('an agent module that fails to load releases the lock', async () => {
    const at = paths()
    const code = await runWebviewApp({ manifest, views: { kind: 'none' }, paths: at, argv: [], logWhenDetached: false, module: async () => { throw new Error('bad module') }, spawn: () => ({ exited: Promise.resolve(0), kill: () => {} }) })
    expect(code).toBe(1)
    expect(existsSync(at.lockFile)).toBe(false)
  })
})
