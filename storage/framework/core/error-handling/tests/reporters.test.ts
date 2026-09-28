import type { ErrorReport, ErrorReporter } from '@stacksjs/types'
import fs from 'node:fs'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { report } from '../../logging/src'
import { ErrorHandler } from '../src/handler'
import { flushErrorReporters, registerErrorReporter, reporters } from '../src/reporters'

let detachers: Array<() => void> = []

afterEach(() => {
  for (const detach of detachers) detach()
  detachers = []
})

function attach(reports: ErrorReport[], options: Partial<ErrorReporter> = {}): void {
  detachers.push(registerErrorReporter({
    name: options.name ?? 'test-reporter',
    report: options.report ?? (event => reports.push(event)),
    flush: options.flush,
  }))
}

describe('error reporters', () => {
  test('loads reporters declared by monitoring config before the first delivery', async () => {
    const moduleUrl = new URL('../src/reporters.ts', import.meta.url).href
    const marker = '__STACKS_CONFIGURED_REPORTERS__'
    const child = Bun.spawn({
      cmd: [process.execPath, '-e', [
        `const received = []`,
        `globalThis[Symbol.for('@stacksjs/config:overrides')] = { monitoring: { reporters: [{ name: 'configured', report: event => received.push(event.error.message) }] } }`,
        `const { captureError } = await import(${JSON.stringify(moduleUrl)})`,
        `captureError(new Error('configured failure'))`,
        `console.log(${JSON.stringify(marker)} + JSON.stringify(received))`,
      ].join(';')],
      cwd: new URL('../../../../../', import.meta.url).pathname,
      env: process.env,
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
    expect(JSON.parse(line!.slice(marker.length))).toEqual(['configured failure'])
  })

  test('receive errors handled by ErrorHandler', () => {
    const reports: ErrorReport[] = []
    attach(reports)
    const error = new Error('checkout failed')

    expect(ErrorHandler.handle(error, { silent: true })).toBe(error)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.error).toBe(error)
  })

  test('report the same exception only once across two handling layers', () => {
    const reports: ErrorReport[] = []
    attach(reports)
    const error = new Error('database unavailable')

    ErrorHandler.handle(error, { silent: true })
    report(error, { label: '[Router] action.handle()' })

    expect(reports).toHaveLength(1)
    expect(reports[0]?.error).toBe(error)
  })

  test('contains a reporter that throws without interrupting error persistence', async () => {
    const reports: ErrorReport[] = []
    const appendFile = spyOn(fs.promises, 'appendFile').mockResolvedValue(undefined)
    attach([], {
      name: 'broken',
      report: () => { throw new Error('reporter failed') },
    })
    attach(reports, { name: 'healthy' })

    const error = new Error('original failure')
    let handled: Error | undefined
    expect(() => { handled = ErrorHandler.handle(error, { silent: true }) }).not.toThrow()
    expect(handled).toBe(error)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.error).toBe(error)
    await Bun.sleep(0)
    expect(appendFile).toHaveBeenCalled()
    appendFile.mockRestore()
  })

  test('flushes every reporter without exposing a rejected drain', async () => {
    let flushed = 0
    attach([], { name: 'good-flush', flush: async () => { flushed++ } })
    attach([], { name: 'bad-flush', flush: async () => { throw new Error('offline') } })

    await expect(flushErrorReporters()).resolves.toBeUndefined()
    expect(flushed).toBe(1)
  })

  test('contains a reporter that throws synchronously while flushing', async () => {
    attach([], {
      name: 'sync-flush',
      flush: (() => { throw new Error('flush failed') }) as () => Promise<void>,
    })

    await expect(flushErrorReporters()).resolves.toBeUndefined()
  })

  test('returns a copy of the registered reporter list', () => {
    attach([])

    const attached = reporters()
    expect(attached.map(reporter => reporter.name)).toEqual(['test-reporter'])
    ;(attached as ErrorReporter[]).length = 0
    expect(reporters()).toHaveLength(1)
  })
})
