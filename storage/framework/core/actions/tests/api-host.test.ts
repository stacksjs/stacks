import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveApiHost, resolveApiPort } from '../src/helpers/api-host'

describe('resolveApiHost', () => {
  it('keeps development servers local by default', () => {
    expect(resolveApiHost({})).toBe('127.0.0.1')
  })

  it('binds production servers to all interfaces by default', () => {
    expect(resolveApiHost({ APP_ENV: 'production' })).toBe('0.0.0.0')
    expect(resolveApiHost({ NODE_ENV: 'production' })).toBe('0.0.0.0')
  })

  it('supports API_HOST and the conventional HOST fallback', () => {
    expect(resolveApiHost({ API_HOST: '10.0.0.8', HOST: '127.0.0.1' })).toBe('10.0.0.8')
    expect(resolveApiHost({ HOST: '::' })).toBe('::')
  })
})

describe('API listener ownership', () => {
  it('keeps explicit ephemeral ports and the configured/default port', () => {
    expect(resolveApiPort('0', 3008)).toBe(0)
    expect(resolveApiPort(undefined, 0)).toBe(0)
    expect(resolveApiPort(undefined, 3410)).toBe(3410)
    expect(resolveApiPort('', 3410)).toBe(3410)
    expect(resolveApiPort('4321', 3410)).toBe(4321)
    expect(resolveApiPort(undefined)).toBe(3008)
    for (const value of ['-1', '65536', '1.5', 'NaN', 'no-port'])
      expect(() => resolveApiPort(value)).toThrow('PORT_API')
  })

  it('announces the listening port over IPC and serves at that address', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-api-ready-'))
    const script = join(directory, 'server.ts')
    const bunfig = join(directory, 'bunfig.toml')
    await Bun.write(bunfig, '')
    await Bun.write(script, `
import { resolveApiPort, reportApiReady } from ${JSON.stringify(fileURLToPath(new URL('../src/helpers/api-host.ts', import.meta.url)))}
const server = Bun.serve({ hostname: '127.0.0.1', port: resolveApiPort(process.env.PORT_API), fetch: () => new Response('owned listener') })
reportApiReady(server)
`)
    const ready = Promise.withResolvers<{ type: string, port: number, url: string }>()
    const child = Bun.spawn([process.execPath, '--no-env-file', `--config=${bunfig}`, script], {
      env: { ...process.env, PORT_API: '0' }, stdout: 'pipe', stderr: 'pipe',
      ipc(message) { ready.resolve(message) },
    })
    const timeout = setTimeout(() => ready.reject(new Error('API did not announce its listener')), 5000)
    try {
      const message = await Promise.race([ready.promise, child.exited.then(() => { throw new Error('API exited before readiness') })])
      expect(message.type).toBe('stacks:api-ready')
      expect(message.port).toBeGreaterThan(0)
      expect(Number(new URL(message.url).port)).toBe(message.port)
      expect(await (await fetch(message.url)).text()).toBe('owned listener')
    }
    finally {
      clearTimeout(timeout)
      child.kill('SIGTERM')
      await child.exited
      rmSync(directory, { recursive: true, force: true })
    }
    expect(await new Response(child.stdout).text()).toContain('API server ready: http://127.0.0.1:')
  })
})
