import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import type { ChromeLaunchDiagnostics } from '../src/browser'
import { launch } from '../src/browser'

const fixtures: string[] = []
afterEach(() => fixtures.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })))

function executable(body: string): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-browser-startup-test-'))
  fixtures.push(root)
  const script = join(root, 'process.ts')
  const binary = join(root, 'fake-chrome')
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
  writeFileSync(script, body)
  writeFileSync(binary, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(script)} "$@"\n`)
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

  const protocolProcess = (respond: boolean, handshake = true) => `
    const profile = process.argv.find(value => value.startsWith('--user-data-dir='))!.slice(16)
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0,
      fetch(request, server) {
        if (new URL(request.url).pathname === '/devtools/page/fixture') {
          if (!${handshake}) return new Promise(() => {})
          if (server.upgrade(request)) return
          return new Response('not upgraded', { status: 400 })
        }
        return Response.json([{ type: 'page', url: 'about:blank', webSocketDebuggerUrl: 'ws://127.0.0.1:' + server.port + '/devtools/page/fixture' }])
      },
      websocket: { message(socket, raw) {
        if (!${respond}) return
        const { id, method } = JSON.parse(String(raw))
        socket.send(JSON.stringify({ id, result: method === 'Browser.getVersion' ? { userAgent: 'HeadlessChrome Fixture' } : {} }))
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
