import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runIsolated } from '../src/isolated'
import { startTestService } from '../src/service'
const fixture = join(import.meta.dir, '../fixtures/isolated/process-tree.ts')
interface Endpoint { origin: string, owner: string, role: string }
function endpoint(directory: string, role: string): Endpoint {
  return JSON.parse(readFileSync(join(directory, `${role}.json`), 'utf8'))
}
async function alive(target: Endpoint): Promise<boolean> {
  try {
    const result = await fetch(target.origin, { headers: { 'x-fixture-owner': target.owner }, signal: AbortSignal.timeout(500) })
    const body = await result.json()
    return result.ok && body.owner === target.owner && body.role === target.role
  }
  catch { return false }
}
async function retire(directory: string, role: string): Promise<void> {
  if (!existsSync(join(directory, `${role}.json`))) return
  const target = endpoint(directory, role)
  try { await fetch(`${target.origin}/stop`, { headers: { 'x-fixture-owner': target.owner }, signal: AbortSignal.timeout(500) }) }
  catch { /* The owned fixture has already exited. */ }
}
async function withTree(work: (directory: string, owner: string) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-owned-tree-'))
  const owner = crypto.randomUUID()
  writeFileSync(join(directory, 'bunfig.toml'), 'preload = []\n')
  const unrelated = Bun.spawn([process.execPath, '--no-env-file', `--config=${join(directory, 'bunfig.toml')}`, fixture, 'unrelated', directory, owner], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
  try {
    const deadline = performance.now() + 8000
    while (!existsSync(join(directory, 'unrelated.json'))) {
      if (performance.now() > deadline) throw new Error('Unrelated fixture did not become ready')
      await Bun.sleep(5)
    }
    await work(directory, owner)
  }

  finally {
    await Promise.all(['child', 'grandchild'].map(role => retire(directory, role)))
    unrelated.kill('SIGKILL')
    await unrelated.exited
    rmSync(directory, { recursive: true, force: true })
  }
}

const budget = process.platform === 'win32' ? 8000 : 1000

test('isolated timeout disposes its child and grandchild while an unrelated process survives', () => withTree(async (directory, owner) => {
  const result = await runIsolated(fixture, { cwd: directory, bunfig: 'bunfig.toml', envFile: false, args: ['root', directory, owner], timeoutMs: budget })
  expect(result.timedOut).toBe(true)
  expect(result.stdout).toContain('owned tree ready')
  expect(await alive(endpoint(directory, 'child'))).toBe(false)
  expect(await alive(endpoint(directory, 'grandchild'))).toBe(false)
  expect(await alive(endpoint(directory, 'unrelated'))).toBe(true)
}), 30000)

test('a normal early isolated exit disposes remaining descendants and preserves its status', () => withTree(async (directory, owner) => {
  const result = await runIsolated(fixture, { cwd: directory, bunfig: 'bunfig.toml', envFile: false, args: ['early-exit', directory, owner], timeoutMs: 10000 })
  expect(result.code).toBe(7)
  expect(result.timedOut).toBe(false)
  expect(result.stdout).toContain('owned tree ready')
  expect(await alive(endpoint(directory, 'child'))).toBe(false)
  expect(await alive(endpoint(directory, 'grandchild'))).toBe(false)
  expect(await alive(endpoint(directory, 'unrelated'))).toBe(true)
}), 30000)

for (const role of ['service', 'service-no-ready', 'service-early-exit']) {
  test(`owned ${role} forwards IPC and disposes descendants without stopping an unrelated process`, () => withTree(async (directory, owner) => {
    const service = startTestService([process.execPath, '--no-env-file', `--config=${join(directory, 'bunfig.toml')}`, fixture, role, directory, owner], { cwd: directory, startupTimeoutMs: budget, stopGraceMs: 50 })
    const output = new Response(service.stdout).text()
    const errors = new Response(service.stderr).text()
    try {
      if (role === 'service-no-ready') {
        await expect(service.ready).rejects.toThrow('readiness timed out')
        await service.stop()
        expect(service.signal.aborted).toBe(true)
      }
      else {
        expect(await service.ready).toEqual({ role, owner })
        if (role === 'service-early-exit') {
          expect(await service.exited).toBe(7)
          expect(service.signal.aborted).toBe(true)
        }
        else await Promise.all([service.stop(), service.stop()])
      }
      expect(await output).toContain('owned tree ready')
      expect(await errors).toBe('')
      expect(await alive(endpoint(directory, 'child'))).toBe(false)
      expect(await alive(endpoint(directory, 'grandchild'))).toBe(false)
      expect(await alive(endpoint(directory, 'unrelated'))).toBe(true)
    }
    finally { await service.stop() }
  }), 30000)
}

for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
  test(`signaling the owned service PID with ${signal} disposes its tree and aborts work`, () => withTree(async (directory, owner) => {
    const service = startTestService([process.execPath, '--no-env-file', `--config=${join(directory, 'bunfig.toml')}`, fixture, 'service', directory, owner], { cwd: directory, startupTimeoutMs: budget, stopGraceMs: 50 })
    const output = new Response(service.stdout).text()
    const errors = new Response(service.stderr).text()
    try {
      expect(await service.ready).toEqual({ role: 'service', owner })
      process.kill(service.pid, signal)
      const result = (await Promise.allSettled([service.exited]))[0]!
      if (result.status === 'rejected') expect(String(result.reason)).toContain('Owned process host exited')
      expect(service.signal.aborted).toBe(true)
      expect(await alive(endpoint(directory, 'child'))).toBe(false)
      expect(await alive(endpoint(directory, 'grandchild'))).toBe(false)
      expect(await alive(endpoint(directory, 'unrelated'))).toBe(true)
      await Promise.all([output, errors])
    }
    finally { await service.stop() }
  }), 30000)
}

test('isolated application preload options execute only in the admitted command', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks owned preload-'))
  const log = join(directory, 'preload-pids.txt')
  const preload = join(directory, 'preload.ts')
  const script = join(directory, 'command.ts')
  writeFileSync(join(directory, 'bunfig.toml'), 'preload = []\n')
  writeFileSync(preload, 'import { appendFileSync } from "node:fs"; appendFileSync(process.env.OWNED_PRELOAD_LOG!, String(process.pid) + "\\n")\n')
  writeFileSync(script, 'process.stdout.write(JSON.stringify({ pid: process.pid, options: process.env.BUN_OPTIONS, nodeOptions: process.env.NODE_OPTIONS, value: process.env.OWNED_PRELOAD_VALUE }))\n')
  const bunOptions = '--preload=./preload.ts'
  try {
    const result = await runIsolated(script, { cwd: directory, bunfig: 'bunfig.toml', envFile: false, timeoutMs: 10000, env: { BUN_OPTIONS: bunOptions, NODE_OPTIONS: '--trace-warnings', OWNED_PRELOAD_LOG: log, OWNED_PRELOAD_VALUE: 'consumer environment' } })
    expect(result.code, result.stderr).toBe(0)
    const output = JSON.parse(result.stdout)
    expect(output).toEqual({ pid: output.pid, options: bunOptions, nodeOptions: '--trace-warnings', value: 'consumer environment' })
    expect(readFileSync(log, 'utf8').trim().split('\n').map(Number)).toEqual([output.pid])
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 20000)

test('service application preloads run after native admission and retain their original environment', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks owned service preload-'))
  const log = join(directory, 'preload-pids.txt')
  const preload = join(directory, 'preload.ts')
  const script = join(directory, 'command.ts')
  writeFileSync(join(directory, 'bunfig.toml'), 'preload = []\n')
  writeFileSync(preload, 'import { appendFileSync } from "node:fs"; appendFileSync(process.env.OWNED_PRELOAD_LOG!, String(process.pid) + "\\n")\n')
  writeFileSync(script, `import { notifyTestServiceReady } from ${JSON.stringify(join(import.meta.dir, '../src/service.ts'))}; notifyTestServiceReady({ pid: process.pid, options: process.env.BUN_OPTIONS, nodeOptions: process.env.NODE_OPTIONS, value: process.env.OWNED_PRELOAD_VALUE }); await Bun.sleep(60000)`)
  const bunOptions = '--preload=./preload.ts'
  const service = startTestService([process.execPath, '--no-env-file', `--config=${join(directory, 'bunfig.toml')}`, script], { cwd: directory, startupTimeoutMs: 10000, stopGraceMs: 50, env: { ...process.env, BUN_OPTIONS: bunOptions, NODE_OPTIONS: '--trace-warnings', OWNED_PRELOAD_LOG: log, OWNED_PRELOAD_VALUE: 'consumer environment' } })
  const output = new Response(service.stdout).text()
  const errors = new Response(service.stderr).text()
  try {
    const ready = await service.ready
    const pids = readFileSync(log, 'utf8').trim().split('\n').map(Number)
    expect(pids).toHaveLength(1)
    expect(pids).not.toContain(service.pid)
    expect(ready).toEqual({ pid: pids[0], options: bunOptions, nodeOptions: '--trace-warnings', value: 'consumer environment' })
  }
  finally {
    await service.stop()
    await Promise.all([output, errors])
    rmSync(directory, { recursive: true, force: true })
  }
}, 20000)
