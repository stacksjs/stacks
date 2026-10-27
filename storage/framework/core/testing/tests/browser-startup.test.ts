import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import type { ChromeLaunchDiagnostics } from '../src/browser'
import { closeSharedBrowsers, launch, waitFor } from '../src/browser'

const fixtures: string[] = []
afterEach(() => fixtures.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })))

function executable(body: string): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-browser-startup-test-'))
  fixtures.push(root)
  const script = join(root, 'process.ts')
  const binary = join(root, 'fake-chrome')
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  writeFileSync(script, body)
  // The fixture is a standalone executable. Loading the caller's Bun config
  // here would boot its application before the protocol process even starts.
  writeFileSync(binary, `#!/bin/sh\ncd ${quote(root)} || exit 1\nexec ${quote(process.execPath)} ${quote(script)} "$@"\n`)
  chmodSync(binary, 0o755)
  return binary
}

type StartupFailure = Error & { diagnostics: ChromeLaunchDiagnostics }
async function failure(chromePath: string, startTimeoutMs = 2_000, profile?: string): Promise<StartupFailure> {
  try {
    const browser = await launch({ chromePath, startTimeoutMs, profile })
    await browser.close()
    throw new Error('The fixture unexpectedly launched a browser')
  }
  catch (error) {
    expect(error).toHaveProperty('diagnostics')
    return error as StartupFailure
  }
}

// Real disposable child processes; these fixtures never run Chrome.
describe.skipIf(process.platform === 'win32')('browser startup failure evidence', () => {
  test('preserves a spawn failure and removes the unused temporary profile', async () => {
    const path = executable('process.exit(0)')
    chmodSync(path, 0o600)
    const error = await failure(path)
    expect(error.message).toMatch(/EACCES|permission denied/i)
    expect(error.diagnostics.pid).toBeNull()
    expect(error.diagnostics.cleanupError).toBeNull()
    expect(existsSync(error.diagnostics.profile)).toBe(false)
  })

  test('retains the real exit and bounded stderr, and removes its own profile', async () => {
    const path = executable(`await Bun.write(Bun.stderr, 'x'.repeat(40_000) + '\\nDBus library unavailable: startup-tail\\n'); process.exit(43)`)
    const error = await failure(path)
    expect(error.name).toBe('ChromeLaunchError')
    expect(error.diagnostics.chromePath).toBe(path)
    expect(error.diagnostics.exitCodeBeforeCleanup).toBe(43)
    expect(error.diagnostics.stderrTail).toContain('DBus library unavailable: startup-tail')
    expect(error.diagnostics.stderrTail.length).toBeLessThanOrEqual(16_384)
    expect(error.diagnostics.stderrTruncated).toBe(true)
    expect(error.diagnostics.portFileExisted).toBe(false)
    expect(existsSync(error.diagnostics.profile)).toBe(false)
    expect(() => process.kill(error.diagnostics.pid!, 0)).toThrow()
  })

  test('reports malformed port evidence and preserves a caller-owned profile', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-browser-kept-test-'))
    fixtures.push(root)
    const profile = join(root, 'profile')
    mkdirSync(profile)
    const path = executable(`
      const profile = process.argv.find(value => value.startsWith('--user-data-dir='))!.slice(16)
      await Bun.write(profile + '/DevToolsActivePort', 'invalid-port\\n/devtools/browser/fixture\\n')
      console.error('invalid port fixture')
      setTimeout(() => process.exit(7), 150)
    `)
    const started = Date.now()
    const error = await failure(path, 2_000, profile)
    expect(Date.now() - started).toBeLessThan(3_000)
    expect(error.diagnostics.portFileExisted).toBe(true)
    expect(error.diagnostics.portFileContents).toContain('invalid-port')
    expect(existsSync(profile)).toBe(true)
    expect(() => process.kill(error.diagnostics.pid!, 0)).toThrow()
  }, 15_000)

  test('enforces the startup deadline and reaps a process which ignores SIGTERM', async () => {
    const path = executable(`process.on('SIGTERM', () => {}); console.error('fixture waiting'); setTimeout(() => process.exit(0), 8_000)`)
    const started = Date.now()
    const error = await failure(path, 2_000)
    expect(Date.now() - started).toBeLessThan(6_000)
    expect(error.diagnostics.stderrTail).toContain('fixture waiting')
    expect(error.diagnostics.exitCodeBeforeCleanup).toBeNull()
    expect(error.diagnostics.cleanupError).toBeNull()
    expect(existsSync(error.diagnostics.profile)).toBe(false)
    expect(() => process.kill(error.diagnostics.pid!, 0)).toThrow()
  }, 15_000)

  const protocolProcess = (respond: boolean, handshake: boolean | string = true, numberedTargets = false) => `
    const profile = process.argv.find(value => value.startsWith('--user-data-dir='))!.slice(16)
    let target = 0
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0,
      fetch(request, server) {
        if (new URL(request.url).pathname.startsWith('/devtools/')) {
          const handshake = ${JSON.stringify(handshake)}
          if (handshake === false || new URL(request.url).pathname === handshake) return new Promise(() => {})
          if (server.upgrade(request)) return
          return new Response('not upgraded', { status: 400 })
        }
        return Response.json([{ type: 'page', url: 'about:blank', webSocketDebuggerUrl: 'ws://127.0.0.1:' + server.port + '/devtools/page/fixture' }])
      },
      websocket: { message(socket, raw) {
        if (!${respond}) return
        const { id, method } = JSON.parse(String(raw))
        const results = { 'Browser.getVersion': { userAgent: 'HeadlessChrome Fixture' }, 'Target.createBrowserContext': { browserContextId: 'fixture-context' }, 'Target.createTarget': { targetId: 'fixture' } }
        const result = results[method] ?? {}
        if (${numberedTargets} && method === 'Target.createTarget') result.targetId = 'fixture-' + (++target)
        socket.send(JSON.stringify({ id, result }))
      } },
    })
    await Bun.write(profile + '/fixture.pid', String(process.pid))
    await Bun.write(profile + '/DevToolsActivePort', String(server.port) + '\\n/devtools/browser/fixture\\n')
    console.error('protocol fixture ready')
  `

  test('bounds a DevTools WebSocket which never completes its handshake', async () => {
    const error = await failure(executable(protocolProcess(true, false)), 2_000)
    expect(error.message).toContain('Timed out connecting to Chrome')
    expect(error.diagnostics.elapsedMs).toBeLessThan(3_000)
    expect(error.diagnostics.portFileExisted).toBe(true)
    expect(error.diagnostics.cleanupError).toBeNull()
    expect(() => process.kill(error.diagnostics.pid!, 0)).toThrow()
  }, 8_000)

  test('keeps the deadline through CDP session initialization', async () => {
    const error = await failure(executable(protocolProcess(false)), 2_000)
    expect(error.diagnostics.elapsedMs).toBeLessThan(3_000)
    expect(error.diagnostics.portFileExisted).toBe(true)
    expect(error.diagnostics.stderrTail).toContain('protocol fixture ready')
    expect(error.diagnostics.cleanupError).toBeNull()
    expect(() => process.kill(error.diagnostics.pid!, 0)).toThrow()
  }, 8_000)

  test('distinguishes a stalled page connection from cold process and browser startup', async () => {
    const error = await failure(executable(protocolProcess(true, '/devtools/page/fixture')), 2_000)
    expect(error.diagnostics.phase).toBe('page-connect')
    const phases = error.diagnostics.phaseStartedMs ?? {}
    expect(Object.keys(phases)).toEqual(['process-acquire', 'process-start', 'devtools-port', 'browser-connect', 'context-create', 'target-create', 'page-connect'])
    expect(phases['process-acquire']).toBe(0)
    const times = Object.values(phases) as number[]
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(times.every(value => value >= 0 && value < error.diagnostics.elapsedMs)).toBe(true)
    expect(error.diagnostics.elapsedMs).toBeLessThan(3_000)
    expect(error.diagnostics.cleanupError).toBeNull()
    expect(existsSync(error.diagnostics.profile)).toBe(false)
    expect(() => process.kill(error.diagnostics.pid!, 0)).toThrow()
  }, 8_000)

  test('a failed warm session reports its own phases and keeps the other session alive', async () => {
    const path = executable(protocolProcess(true, '/devtools/page/fixture-2', true))
    const started = Date.now()
    const first = await launch({ chromePath: path, startTimeoutMs: 2_000 })
    try {
      // Separate the process's age from the next launch's own deadline.
      await Bun.sleep(150)
      const error = await failure(path, 2_000)
      expect(error.diagnostics.phase).toBe('page-connect')
      expect(Object.keys(error.diagnostics.phaseStartedMs ?? {})).toEqual(['process-acquire', 'context-create', 'target-create', 'page-connect'])
      expect(error.diagnostics.elapsedMs).toBeLessThan(Date.now() - started - 100)
      expect(first.cdp.closed).toBe(false)
      expect((await first.cdp.send('Browser.getVersion')).userAgent).toBe('HeadlessChrome Fixture')
      expect(error.diagnostics.cleanupError).toBeNull()
      expect(existsSync(error.diagnostics.profile)).toBe(true)
    }
    finally {
      await first.close()
      await closeSharedBrowsers()
    }
  }, 8_000)

  test('a second launch keeps its own deadline while another caller starts Chrome', async () => {
    const path = executable(`${protocolProcess(true, false)}\nawait Bun.write(import.meta.dir + '/ready', String(process.pid))`)
    const first = launch({ chromePath: path, startTimeoutMs: 2_000 }).catch(error => error)
    try {
      const ready = join(dirname(path), 'ready')
      await waitFor(() => existsSync(ready), 1_000)
      const pid = Number(readFileSync(ready, 'utf8'))
      const started = Date.now()
      const error = await launch({ chromePath: path, startTimeoutMs: 100 }).catch(error => error)
      expect(error).toBeInstanceOf(Error)
      expect(Date.now() - started).toBeLessThan(1_000)
      // This caller owns a shorter wait, not the still-starting native process.
      expect(() => process.kill(pid, 0)).not.toThrow()
    }
    finally {
      await first
      await closeSharedBrowsers()
    }
  }, 8_000)

  test('opens a real protocol session and concurrent close calls await the same cleanup', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-browser-close-test-'))
    fixtures.push(root)
    const browser = await launch({ chromePath: executable(protocolProcess(true)), profile: root, startTimeoutMs: 3_000 })
    const pid = Number(readFileSync(join(root, 'fixture.pid'), 'utf8'))
    const first = browser.close()
    const second = browser.close()
    expect(first).toBe(second)
    await Promise.all([first, second])
    expect(browser.cdp.closed).toBe(true)
    expect(existsSync(root)).toBe(true)
    expect(() => process.kill(pid, 0)).toThrow()
  }, 8_000)
})
