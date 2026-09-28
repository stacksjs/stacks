import type { ErrorReport } from '@stacksjs/types'
import { afterEach, describe, expect, test } from 'bun:test'
import { createBugHqReporter } from '../src/bughq'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function event(message = 'checkout failed'): ErrorReport {
  return {
    error: new Error(message),
    context: { requestId: 'req-1', method: 'POST', url: '/checkout' },
  }
}

describe('BugHQ error reporter', () => {
  test('does not construct a reporter or send a request without credentials', async () => {
    let requests = 0
    globalThis.fetch = Object.assign(async () => {
      requests++
      return new Response(null, { status: 201 })
    }, originalFetch)

    const reporter = createBugHqReporter({ key: '', dsn: '', environment: 'production' })

    expect(reporter).toBeNull()
    await Promise.resolve()
    expect(requests).toBe(0)
  })

  test('captures an exception with context and drains the SDK', async () => {
    const requests: Array<{ url: string, body: Record<string, unknown> }> = []
    globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
      })
      return new Response(null, { status: 201 })
    }, originalFetch)

    const reporter = createBugHqReporter({
      key: 'bughq_test',
      host: 'https://errors.example.com/',
      project: 'checkout',
      release: 'v1.2.3',
      environment: 'production',
      maxRetries: 0,
    })!

    expect(() => reporter.report(event())).not.toThrow()
    await reporter.flush?.()

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://errors.example.com/errors')
    expect(requests[0]?.body).toMatchObject({
      key: 'bughq_test',
      project: 'checkout',
      type: 'Error',
      message: 'checkout failed',
      release: 'v1.2.3',
      environment: 'production',
      framework: 'stacks',
      extra: { requestId: 'req-1', method: 'POST', url: '/checkout' },
    })
  })

  test('contains a rejected request', async () => {
    globalThis.fetch = Object.assign(async () => {
      throw new Error('network unavailable')
    }, originalFetch)
    const reporter = createBugHqReporter({
      key: 'bughq_test',
      environment: 'production',
      maxRetries: 0,
    })!

    expect(() => reporter.report(event())).not.toThrow()
    await expect(reporter.flush?.()).resolves.toBeUndefined()
  })
})

describe('default monitoring config', () => {
  async function readConfig(environment: string, key: string): Promise<{
    key?: string
    reporters: string[]
  }> {
    const configUrl = new URL('../../../../../config/monitoring.ts', import.meta.url).href
    const marker = '__STACKS_MONITORING_CONFIG__'
    const child = Bun.spawn({
      cmd: [process.execPath, '-e', [
        `const module = await import(${JSON.stringify(configUrl)})`,
        `console.log(${JSON.stringify(marker)} + JSON.stringify({ key: module.default.bughq?.key, reporters: module.default.reporters?.map(reporter => reporter.name) ?? [] }))`,
      ].join(';')],
      cwd: new URL('../../../../../', import.meta.url).pathname,
      env: { ...process.env, APP_ENV: environment, BUGHQ_KEY: key },
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

  test('registers BugHQ in an allowed environment when a key is present', async () => {
    expect(await readConfig('production', 'bughq_test')).toEqual({
      key: 'bughq_test',
      reporters: ['bughq'],
    })
  })

  test('does not register BugHQ when the key is absent', async () => {
    expect(await readConfig('production', '')).toEqual({ key: '', reporters: [] })
  })

  test('does not register BugHQ outside the shared telemetry environments', async () => {
    expect(await readConfig('local', 'bughq_test')).toEqual({ key: 'bughq_test', reporters: [] })
  })
})
