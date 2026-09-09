import { appPath } from '@stacksjs/path'
import { getTraceId, withTraceId } from '@stacksjs/router'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { runJob } from '../src/job'

const name = `__QueueTrace_${crypto.randomUUID().replaceAll('-', '')}`
const path = appPath(`Jobs/${name}.ts`)
let created = false
beforeAll(() => {
  mkdirSync(appPath('Jobs'), { recursive: true })
  writeFileSync(path, 'export default { async handle(payload: { run: () => Promise<void> | void }) { await payload.run() } }\n', { flag: 'wx' })
  created = true
})
afterAll(() => {
  if (created) unlinkSync(path)
})

test('warm job execution keeps concurrent explicit trace scopes separate and restores the parent', async () => {
  await runJob(name, { traceId: 'warm', payload: { run: () => {} } })
  let entered = 0
  let release = () => {}
  const gate = new Promise<void>((resolve) => { release = resolve })
  const seen: Array<[string, string | undefined, string | undefined]> = []
  const outside = getTraceId()
  await withTraceId('parent', async () => {
    await Promise.all(['alpha', 'beta'].map(traceId => runJob(name, {
      traceId,
      payload: {
        run: async () => {
          const before = getTraceId()
          if (++entered === 2) release()
          await gate
          seen.push([traceId, before, getTraceId()])
        },
      },
    })))
    expect(getTraceId()).toBe('parent')
  })
  expect(seen.sort()).toEqual([['alpha', 'alpha', 'alpha'], ['beta', 'beta', 'beta']])
  expect(getTraceId()).toBe(outside)
})

test('jobs without an explicit trace generate fresh IDs and restore context after failure', async () => {
  const traces: Array<string | undefined> = []
  const outside = getTraceId()
  const failure = new Error('job handler failed')
  await withTraceId('outer', async () => {
    await expect(runJob(name, { traceId: 'failed-job', payload: { run: () => { traces.push(getTraceId()); throw failure } } })).rejects.toBe(failure)
    expect(getTraceId()).toBe('outer')
    for (let i = 0; i < 2; i++) {
      await runJob(name, { payload: { run: () => { traces.push(getTraceId()) } } })
      expect(getTraceId()).toBe('outer')
    }
  })
  expect(traces[0]).toBe('failed-job')
  expect(traces[1]).toStartWith(`job:${name}:`)
  expect(traces[2]).toStartWith(`job:${name}:`)
  expect(traces[1]).not.toBe(traces[2])
  expect(getTraceId()).toBe(outside)
})
