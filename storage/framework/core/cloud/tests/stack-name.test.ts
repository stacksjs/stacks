import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The stack @stacksjs/cloud acts on follows the app's environment.
 *
 * It was computed at import from `config.app.env`, which is still the
 * framework default `'local'` at that point, so it was `stacks-cloud-dev`
 * everywhere: in production, `cloud:remove` and every jump-box lookup named
 * the development stack.
 */
let project: string

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'stacks-cloud-name-'))
  await writeFile(join(project, 'bunfig.toml'), '# no preload\n')
})

afterEach(async () => {
  await rm(project, { recursive: true, force: true })
})

async function stackName(env: Record<string, string> = {}): Promise<string> {
  const child = Bun.spawn([process.execPath, `--config=${join(project, 'bunfig.toml')}`, '--no-env-file', join(import.meta.dir, 'fixtures/cloud-name.ts')], {
    cwd: project,
    env: { ...process.env, APP_ENV: '', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
  if (code !== 0 || !line)
    throw new Error(`fixture exited ${code}\n${stdout}\n${stderr}`)
  return JSON.parse(line).name
}

describe('stacksCloudName', () => {
  it('names the environment config/app.ts sets', async () => {
    await mkdir(join(project, 'config'), { recursive: true })
    await writeFile(join(project, 'config/app.ts'), `export default { env: 'staging' }\n`)

    expect(await stackName()).toBe('stacks-cloud-staging')
  }, 60_000)

  it('names the environment APP_ENV sets', async () => {
    expect(await stackName({ APP_ENV: 'production' })).toBe('stacks-cloud-production')
  }, 60_000)
})
