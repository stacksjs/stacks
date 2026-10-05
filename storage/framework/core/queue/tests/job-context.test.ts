import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createEnvelope, parseEnvelope, serializeEnvelope } from '../src/envelope'

/**
 * `job(...).withContext(x)` reaches the job, on every driver.
 *
 * Only the sync driver passed the context on. The database and Redis drivers
 * wrote an envelope with no place for it, and `runJob` handed a `handle()`
 * job its payload alone - so a dispatch that saw its context in development
 * lost it on every real queue.
 */

describe('the envelope', () => {
  test('carries the context across the wire', () => {
    const envelope = createEnvelope('ContextJob', { orderId: 7 }, { queue: 'default' }, 'trace-1', { tenant: 'acme' })
    const parsed = parseEnvelope(serializeEnvelope(envelope))

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.envelope.context).toEqual({ tenant: 'acme' })
      expect(parsed.envelope.traceId).toBe('trace-1')
    }
  })

  test('has no context key when there is none, as before', () => {
    const envelope = createEnvelope('ContextJob', {}, {})
    expect('context' in envelope).toBe(false)
    const parsed = parseEnvelope(serializeEnvelope(envelope))
    expect(parsed.ok && 'context' in parsed.envelope).toBe(false)
  })

  test('keeps a falsy context, which is still one', () => {
    const parsed = parseEnvelope(serializeEnvelope(createEnvelope('ContextJob', {}, {}, undefined, 0)))
    expect(parsed.ok && parsed.envelope.context).toBe(0)
  })
})

test('the database worker hands a handle() job its context beside the payload', async () => {
  const project = await mkdtemp(join(tmpdir(), 'stacks-job-context-'))
  try {
    await mkdir(join(project, 'app/Jobs'), { recursive: true })
    await writeFile(join(project, 'bunfig.toml'), '# no preload\n')
    await writeFile(join(project, 'app/Jobs/ContextJob.ts'), `const seen = []
export const calls = () => seen
export default {
  handle: (payload, context) => { seen.push({ payload, context }) },
}
`)
    const child = Bun.spawn([process.execPath, `--config=${join(project, 'bunfig.toml')}`, '--no-env-file', `${import.meta.dir}/fixtures/job-context.ts`], {
      cwd: project,
      env: { ...process.env, APP_ENV: 'test', QUEUE_DRIVER: 'database', STACKS_QUEUE_FIXTURE_DB: join(project, 'queue.sqlite') },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    const result = JSON.parse(stdout.trim().split('\n').reverse().find(line => line.startsWith('{'))!)

    expect(result).toEqual({
      remaining: 0,
      calls: [{ payload: { orderId: 7 }, context: { tenant: 'acme', userId: 42 } }],
      failures: [],
    })
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
}, 45_000)
