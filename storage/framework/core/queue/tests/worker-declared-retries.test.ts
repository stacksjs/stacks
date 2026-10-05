import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * A job dispatched by name is retried as often as it declares.
 *
 * The worker read `tries` only from the envelope, and a by-name dispatch
 * writes none, so it defaulted to one attempt: the first transient failure
 * went to failed_jobs although the job asked for more.
 */
test('the worker retries a by-name dispatch as many times as the job declares', async () => {
  const project = await mkdtemp(join(tmpdir(), 'stacks-worker-retries-'))
  try {
    await mkdir(join(project, 'app/Jobs'), { recursive: true })
    await writeFile(join(project, 'bunfig.toml'), '# no preload\n')
    await writeFile(join(project, 'app/Jobs/FlakyJob.ts'), `let count = 0
export const runs = () => count
export default {
  name: 'FlakyJob',
  tries: 2,
  backoff: [0],
  handle: () => {
    count++
    if (count === 1)
      throw new Error('transient')
  },
}
`)
    const child = Bun.spawn([process.execPath, `--config=${join(project, 'bunfig.toml')}`, '--no-env-file', `${import.meta.dir}/fixtures/worker-declared-retries.ts`], {
      cwd: project,
      env: { ...process.env, APP_ENV: 'test', QUEUE_DRIVER: 'database', STACKS_QUEUE_FIXTURE_DB: join(project, 'queue.sqlite') },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    const result = JSON.parse(line!)

    expect(result).toEqual({ jobs: 0, failed: 0, runs: 2 })
  }
  finally {
    await rm(project, { recursive: true, force: true })
  }
}, 45_000)
