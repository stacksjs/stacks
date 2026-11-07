import { expect, test } from 'bun:test'
import { buddyOptionArgs, parseArgv } from '@stacksjs/cli'
import { withDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'
import { queueActionOptions } from '../src/queue/options'

test('queue actions preserve Buddy values in both argument forms', () => {
  const expected = { queue: '01=mail queue', id: '003', for: '120', force: 'true' }
  expect(queueActionOptions(buddyOptionArgs({ queue: expected.queue, id: expected.id, for: 120, force: true }))).toEqual(expected)
  expect(queueActionOptions(['--queue=01=mail queue', '--id=003', '--for=120', '--force'])).toEqual(expected)
  expect(queueActionOptions(['--force=false'])).toEqual({ force: 'false' })
  expect(() => queueActionOptions(['--queue', '--force'])).toThrow('--queue requires a value')
  expect(parseArgv(['--number=3', '--flag=false']).options).toEqual({ number: 3, flag: false })
})

test('real queue actions pause, resume, clear and retry only the requested identities', async () => {
  await withDisposableDatabase('sqlite', async database => {
    const result = await runIsolated(`${import.meta.dir}/fixtures/queue-command-options.ts`, {
      cwd: database.directory, env: { ...database.env, APP_ENV: 'test', QUEUE_DRIVER: 'database' },
      envFile: false, preload: [], timeoutMs: 20000,
    })
    assertIsolatedOk(result, 'scoped queue controls preserve unrelated jobs')
  })
}, 30000)
