import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'
import { assertIsolatedOk, isolatedCommand, runIsolated } from '../src/isolated'

const fixture = (name: string) => join(import.meta.dir, '../fixtures/isolated', name)
const read = (stdout: string) => JSON.parse(stdout.trim().split('\n').pop()!)

describe('runIsolated', () => {
  test('runs a script with its own env and args, and collects both streams', async () => {
    process.env.ISOLATED_REMOVED = 'parent'
    try {
      const result = await runIsolated(fixture('echo.ts'), { env: { ISOLATED_MARKER: 'child', ISOLATED_REMOVED: undefined }, args: ['one', 'two'] })
      expect(result.code).toBe(0)
      expect(result.timedOut).toBe(false)
      expect(read(result.stdout)).toEqual({ argv: ['one', 'two'], marker: 'child', removed: null, preloaded: null })
      expect(result.stderr).toContain('to stderr')
    }
    finally {
      delete process.env.ISOLATED_REMOVED
    }
  })

  test('reports a failing exit code', async () => {
    const result = await runIsolated(fixture('echo.ts'), { args: ['fail'] })
    expect(result.code).toBe(3)
    expect(() => assertIsolatedOk(result)).toThrow(/exited 3[\s\S]*to stderr/)
  })

  test('kills a child that outlives its timeout', async () => {
    const result = await runIsolated(fixture('echo.ts'), { args: ['hang'], timeoutMs: 500 })
    expect(result.timedOut).toBe(true)
    expect(result.code).toBeNull()
    expect(result.durationMs).toBeLessThan(5_000)
    expect(() => assertIsolatedOk(result)).toThrow(/timed out/)
  })

  test('feeds stdin and can drop the inherited environment', async () => {
    const result = await runIsolated(fixture('echo.ts'), { args: ['stdin'], stdin: 'hello\n', inheritEnv: false, env: { ISOLATED_MARKER: 'bare' } })
    expect(result.stdout.startsWith('hello\n')).toBe(true)
    expect(read(result.stdout).marker).toBe('bare')
  })

  test('replaces the project preloads with its own', async () => {
    const result = await runIsolated(fixture('echo.ts'), { preload: [fixture('preload.ts')] })
    expect(read(result.stdout).preloaded).toBe('yes')
  })

  test('runs the child with a bunfig of your choice, resolved against cwd', async () => {
    const result = await runIsolated('echo.ts', { cwd: fixture(''), bunfig: 'bunfig.toml' })
    expect(result.code).toBe(0)
    expect(read(result.stdout).preloaded).toBe('from-bunfig')
    expect(result.command).toContain(`--config=${fixture('bunfig.toml')}`)
  })

  test('refuses a missing bunfig, or one alongside preload', async () => {
    await expect(runIsolated(fixture('echo.ts'), { bunfig: fixture('missing.toml') })).rejects.toThrow(/no bunfig at/)
    await expect(runIsolated(fixture('echo.ts'), { bunfig: '' })).rejects.toThrow(TypeError)
    await expect(runIsolated(fixture('echo.ts'), { bunfig: fixture('bunfig.toml'), preload: [] })).rejects.toThrow(/not both/)
  })

  test('runs a test file with bun test, keeping its mock.module out of this process', async () => {
    const result = assertIsolatedOk(await runIsolated(fixture('mocked-module.ts'), { mode: 'test', preload: [] }))
    expect(result.command).toContain('test')
    expect(`${result.stdout}${result.stderr}`).toContain('1 pass')
    const os = await import('node:os')
    expect(os.hostname()).not.toBe('mocked-host')
  })

  test('builds the command line it runs', () => {
    expect(isolatedCommand('a.test.ts').slice(1)).toEqual(['test', 'a.test.ts'])
    expect(isolatedCommand('a.ts', { args: ['x'], envFile: false }).slice(1)).toEqual(['--no-env-file', 'a.ts', 'x'])
    expect(isolatedCommand('a.ts', { mode: 'test', config: '/tmp/b.toml' }).slice(1)).toEqual(['--config=/tmp/b.toml', 'test', 'a.ts'])
  })

  test('refuses bad options', async () => {
    await expect(runIsolated('')).rejects.toThrow(TypeError)
    await expect(runIsolated(fixture('echo.ts'), { timeoutMs: 0 })).rejects.toThrow(RangeError)
  })
})
