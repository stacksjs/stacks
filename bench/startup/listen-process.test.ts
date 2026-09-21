import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { hostEnvironment } from '../routing/runtime'
import { parseListenHandshake, measureListenProcess } from './listen-process'

const temporaryDirectories: string[] = []

function fixture(source: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-listen-process-'))
  temporaryDirectories.push(directory)
  const path = join(directory, 'router.js')
  writeFileSync(path, source)
  return path
}

function measureFixture(path: string, timeoutMs?: number, headers?: Record<string, string>) {
  return measureListenProcess({
    command: [
      process.execPath,
      '--no-env-file',
      `--config=${join(import.meta.dir, 'bunfig.toml')}`,
      join(import.meta.dir, 'listen-sample.ts'),
      path,
    ],
    cwd: dirname(path),
    env: { ...hostEnvironment(), APP_ENV: 'production', NODE_ENV: 'production' },
    headers,
    timeoutMs,
  })
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('spawn-to-ready process measurement', () => {
  test('parses strict readiness handshakes', () => {
    expect(parseListenHandshake('{"port":4321,"rssBytes":123456}')).toEqual({ port: 4321, rssBytes: 123456 })
    expect(() => parseListenHandshake('ready')).toThrow('malformed readiness handshake')
    expect(() => parseListenHandshake('{"port":0,"rssBytes":1}')).toThrow('invalid port')
    expect(() => parseListenHandshake('{"port":4321,"rssBytes":0}')).toThrow('invalid RSS')
  })

  test('measures a fresh process through an exact HTTP response', async () => {
    const path = fixture(`
      export function disableViewRouting() {}
      export function createStacksRouter() {
        let handler
        return {
          bunRouter: {},
          get(_path, value) { handler = value },
          async serve(options) { return Bun.serve({ ...options, fetch: handler }) },
        }
      }
    `)
    const result = await measureFixture(path)
    expect(result.listenMs).toBeGreaterThan(0)
    expect(result.firstResponseMs).toBeGreaterThanOrEqual(result.listenMs)
    expect(result.rssBytes).toBeGreaterThan(0)
    expect(result.response).toEqual({
      status: 200,
      mediaType: 'application/json',
      bodySha256: 'b342fc286d0216cc212e0d7ba234894e2e7283ddf14f959adf0fe7fd5924308a',
    })
  })

  test('rejects child diagnostics and incorrect responses', async () => {
    const diagnostic = fixture(`
      console.error('unexpected diagnostic')
      export function disableViewRouting() {}
      export function createStacksRouter() {
        let handler
        return { bunRouter: {}, get(_path, value) { handler = value }, async serve(options) { return Bun.serve({ ...options, fetch: handler }) } }
      }
    `)
    await expect(measureFixture(diagnostic)).rejects.toThrow('wrote to stderr')

    const incorrect = fixture(`
      export function disableViewRouting() {}
      export function createStacksRouter() {
        return { bunRouter: {}, get() {}, async serve(options) { return Bun.serve({ ...options, fetch: () => new Response('wrong') }) } }
      }
    `)
    await expect(measureFixture(incorrect)).rejects.toThrow('readiness probe returned')
  })

  test('forwards profile request headers to the readiness probe', async () => {
    const path = fixture(`
      export function disableViewRouting() {}
      export function createStacksRouter() {
        let handler
        return {
          bunRouter: {},
          get(_path, value) { handler = value },
          async serve(options) {
            return Bun.serve({
              ...options,
              fetch(req) {
                return req.headers.get('cookie') === 'X-CSRF-Token=known' ? handler(req) : new Response('missing cookie')
              },
            })
          },
        }
      }
    `)
    await expect(measureFixture(path, undefined, { cookie: 'X-CSRF-Token=known' })).resolves.toBeDefined()
    await expect(measureFixture(path)).rejects.toThrow('readiness probe returned')
  })

  test('times out and stops a child that never becomes ready', async () => {
    const path = fixture(`
      export function disableViewRouting() {}
      export function createStacksRouter() {
        return { bunRouter: {}, get() {}, async serve() { await new Promise(() => {}) } }
      }
    `)
    await expect(measureFixture(path, 50)).rejects.toThrow('did not report readiness within 50ms')
  })
})
