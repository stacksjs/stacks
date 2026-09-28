import type { LogRecord } from '@stacksjs/types'
import { afterEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { log, registerTransport } from '../src'
import { createLogHqTransport } from '../src/loghq'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function record(level: LogRecord['level'], message: string): LogRecord {
  return {
    level,
    message,
    args: [message],
    timestamp: '2026-09-28T00:00:00.000Z',
  }
}

describe('LogHQ transport', () => {
  test('does not construct a transport or send a request without an ingest key', async () => {
    let requests = 0
    globalThis.fetch = Object.assign(async () => {
      requests++
      return new Response(null, { status: 201 })
    }, originalFetch)

    const transport = createLogHqTransport({ key: '', environment: 'production' })

    expect(transport).toBeNull()
    expect(requests).toBe(0)

    // The absent transport has no queue or timer that can send later either.
    await Promise.resolve()
    expect(requests).toBe(0)
  })

  test('batches records and drains a partial batch on flush', async () => {
    const bodies: unknown[] = []
    const urls: string[] = []
    globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
      urls.push(String(input))
      bodies.push(JSON.parse(String(init?.body)))
      return Response.json({ ok: true, stored: 2, dropped: 0, skipped: 0 }, { status: 201 })
    }, originalFetch)

    const transport = createLogHqTransport({
      key: 'loghq_test',
      baseUrl: 'https://logs.example.com/',
      environment: 'production',
      project: 'checkout',
      batchSize: 2,
      flushInterval: 0,
      maxRetries: 1,
    })!

    transport.log(record('info', 'first'))
    transport.log(record('warning', 'second'))
    await transport.flush?.()

    expect(bodies).toHaveLength(1)
    expect(urls).toEqual(['https://logs.example.com/logs'])
    expect(bodies[0]).toMatchObject({
      logs: [
        { message: 'first', context: { project: 'checkout' } },
        { message: 'second', context: { project: 'checkout' } },
      ],
    })

    transport.log(record('error', 'third'))
    await transport.flush?.()

    expect(bodies).toHaveLength(2)
    expect(urls).toEqual(['https://logs.example.com/logs', 'https://logs.example.com/logs'])
    expect(bodies[1]).toMatchObject({ logs: [{ message: 'third' }] })
  })

  test('contains a rejected delivery without throwing or logging recursively', async () => {
    let requests = 0
    globalThis.fetch = Object.assign(async () => {
      requests++
      throw new Error('network unavailable')
    }, originalFetch)

    const transport = createLogHqTransport({
      key: 'loghq_test',
      environment: 'production',
      flushInterval: 0,
      maxRetries: 1,
    })!

    expect(() => transport.log(record('error', 'checkout failed'))).not.toThrow()
    await expect(transport.flush?.()).resolves.toBeUndefined()
    expect(requests).toBe(1)
  })

  test('can ship debug records while the console remains at info', async () => {
    const previousLevel = process.env.LOG_LEVEL
    const bodies: Array<{ logs?: Array<{ message?: string, level?: string }> }> = []
    globalThis.fetch = Object.assign(async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return Response.json({ ok: true, stored: 1, dropped: 0, skipped: 0 }, { status: 201 })
    }, originalFetch)

    const transport = createLogHqTransport({
      key: 'loghq_test',
      environment: 'production',
      level: 'debug',
      flushInterval: 0,
      maxRetries: 1,
    })!
    const detach = registerTransport(transport)
    process.env.LOG_LEVEL = 'info'

    try {
      await log.debug('loghq-debug-under-console-threshold')
      await transport.flush?.()

      const delivered = bodies.flatMap(body => body.logs ?? [])
      expect(delivered).toContainEqual(expect.objectContaining({
        message: 'loghq-debug-under-console-threshold',
        level: 'debug',
      }))
    }
    finally {
      detach()
      if (previousLevel === undefined) delete process.env.LOG_LEVEL
      else process.env.LOG_LEVEL = previousLevel
    }
  })

  test('honors the transport level before a record is queued', async () => {
    const bodies: Array<{ logs?: Array<{ message?: string }> }> = []
    globalThis.fetch = Object.assign(async (_input: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return Response.json({ ok: true, stored: 1, dropped: 0, skipped: 0 }, { status: 201 })
    }, originalFetch)

    const transport = createLogHqTransport({
      key: 'loghq_test',
      environment: 'production',
      level: 'warning',
      flushInterval: 0,
      maxRetries: 1,
    })!

    transport.log(record('info', 'below-loghq-threshold'))
    transport.log(record('warning', 'at-loghq-threshold'))
    await transport.flush?.()

    const delivered = bodies.flatMap(body => body.logs ?? [])
    expect(delivered.map(entry => entry.message)).toEqual(['at-loghq-threshold'])
  })
})

describe('default logging config', () => {
  async function readConfig(environment: string, key: string): Promise<{
    key?: string
    transports: string[]
  }> {
    const configUrl = new URL('../../../../../config/logging.ts', import.meta.url).href
    const marker = '__STACKS_LOGGING_CONFIG__'
    const child = Bun.spawn({
      cmd: [process.execPath, '-e', [
        `const module = await import(${JSON.stringify(configUrl)})`,
        `console.log(${JSON.stringify(marker)} + JSON.stringify({ key: module.default.loghq?.key, transports: module.default.transports?.map(t => t.name) ?? [] }))`,
      ].join(';')],
      cwd: new URL('../../../../../', import.meta.url).pathname,
      env: { ...process.env, APP_ENV: environment, LOGHQ_KEY: key },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])

    expect(exitCode, stderr).toBe(0)
    const line = stdout.split('\n').find(value => value.startsWith(marker))
    expect(line, stdout).toBeDefined()
    return JSON.parse(line!.slice(marker.length))
  }

  test('registers LogHQ in an allowed environment when an ingest key is present', async () => {
    expect(await readConfig('production', 'loghq_test')).toEqual({
      key: 'loghq_test',
      transports: ['loghq'],
    })
  })

  test('does not register LogHQ when the key is absent', async () => {
    expect(await readConfig('production', '')).toEqual({
      key: '',
      transports: [],
    })
  })

  test('does not register LogHQ outside the shared telemetry environments', async () => {
    expect(await readConfig('local', 'loghq_test')).toEqual({
      key: 'loghq_test',
      transports: [],
    })
  })
})
