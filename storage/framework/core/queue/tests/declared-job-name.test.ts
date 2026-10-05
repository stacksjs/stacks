import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * A job dispatched under the name it declares is run.
 *
 * `name` on a job is optional and defaults to the file name, but a job that
 * sets one is dispatched under it: `new Job({...}).dispatch()` writes it into
 * the envelope. The worker resolved names only to `app/Jobs/<name>.ts`, so
 * the scaffold's own ExampleJob.ts - `name: 'Example Job'` - failed every run
 * looking for `Example Job.ts`.
 */

async function project(jobs: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'stacks-declared-job-name-'))
  await mkdir(join(root, 'app/Jobs'), { recursive: true })
  await writeFile(join(root, 'bunfig.toml'), '# no preload\n')
  for (const [file, source] of Object.entries(jobs))
    await writeFile(join(root, 'app/Jobs', file), source)
  return root
}

async function run(root: string): Promise<{ code: number, stdout: string, stderr: string }> {
  const child = Bun.spawn([process.execPath, `--config=${join(root, 'bunfig.toml')}`, '--no-env-file', `${import.meta.dir}/fixtures/declared-job-name.ts`], {
    cwd: root,
    env: { ...process.env, APP_ENV: 'test', QUEUE_DRIVER: 'database', STACKS_QUEUE_FIXTURE_DB: join(root, 'queue.sqlite') },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, stdout, stderr }
}

const nightlyReport = `const seen = []
export const received = () => seen
export default {
  name: 'Nightly Report',
  handle: (payload) => { seen.push(payload) },
}
`

test('the worker runs a job dispatched under its declared name', async () => {
  const root = await project({ 'NightlyReport.ts': nightlyReport })
  try {
    const { code, stdout, stderr } = await run(root)
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    const result = JSON.parse(stdout.trim().split('\n').reverse().find(line => line.startsWith('{'))!)

    expect(result).toEqual({ jobs: 0, failed: 0, received: [{ day: '2026-10-05' }], envelopeName: 'Nightly Report', failures: [] })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 45_000)

test('two jobs declaring one name fail the dispatch under it, naming both', async () => {
  const root = await project({
    'NightlyReport.ts': nightlyReport,
    'NightlyReportV2.ts': nightlyReport,
  })
  try {
    const { code, stdout, stderr } = await run(root)
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    const result = JSON.parse(stdout.trim().split('\n').reverse().find(line => line.startsWith('{'))!)

    expect(result.received).toEqual([])
    expect(result.failed).toBe(1)
    expect(result.failures[0]).toContain('NightlyReport.ts')
    expect(result.failures[0]).toContain('NightlyReportV2.ts')
    expect(result.failures[0]).toContain('both declare the name "Nightly Report"')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 45_000)
