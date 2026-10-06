import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The stack @stacksjs/cloud acts on is the one `buddy deploy` creates.
 *
 * It was `stacks-cloud-<env>`, a name no deploy path creates: `deployStack()`
 * and `undeployStack()` name the stack `<project.name>-cloud`. So every lookup
 * through it - the jump box, `isFirstDeployment`, `isFailedState` - asked about
 * a stack that does not exist. Deploy and undeploy now take the name from
 * `stacksCloudName()` too. Its region was a literal us-east-1; it is now where
 * the deploy puts the stack: AWS_REGION, else the configured region.
 *
 * Read per call, from the app's own config/cloud.ts, in a child process so the
 * temporary project is the one resolved.
 */
let project: string

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'stacks-cloud-name-'))
  await writeFile(join(project, 'bunfig.toml'), '# no preload\n')
})

afterEach(async () => {
  await rm(project, { recursive: true, force: true })
})

async function writeCloudConfig(): Promise<void> {
  await mkdir(join(project, 'config'), { recursive: true })
  await writeFile(join(project, 'config/cloud.ts'), `export const tsCloud = {
  project: { name: 'acme', slug: 'acme', region: 'eu-west-2' },
  environments: { staging: { type: 'staging', region: 'ap-southeast-2' } },
}
export default {}
`)
}

async function resolved(env: Record<string, string> = {}): Promise<{ name: string, region: string }> {
  const child = Bun.spawn([process.execPath, `--config=${join(project, 'bunfig.toml')}`, '--no-env-file', join(import.meta.dir, 'fixtures/cloud-name.ts')], {
    cwd: project,
    env: { ...process.env, APP_ENV: '', NODE_ENV: '', AWS_REGION: '', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
  if (code !== 0 || !line)
    throw new Error(`fixture exited ${code}\n${stdout}\n${stderr}`)
  return JSON.parse(line)
}

describe('stacksCloudName', () => {
  it('names the stack buddy deploy creates, <project.name>-cloud', async () => {
    await writeCloudConfig()
    expect((await resolved({ APP_ENV: 'production' })).name).toBe('acme-cloud')
    expect((await resolved({ APP_ENV: 'staging' })).name).toBe('acme-cloud')
  }, 60_000)

  it('falls back to the deploy\'s default without a config/cloud.ts', async () => {
    expect(await resolved()).toEqual({ name: 'stacks-cloud', region: 'us-east-1' })
  }, 60_000)
})

describe('stacksCloudRegion', () => {
  it('is the region config/cloud.ts declares for the environment, then the project\'s', async () => {
    await writeCloudConfig()
    expect((await resolved({ APP_ENV: 'production' })).region).toBe('eu-west-2')
    expect((await resolved({ APP_ENV: 'staging' })).region).toBe('ap-southeast-2')
  }, 60_000)

  it('is AWS_REGION when set, as it is for buddy deploy', async () => {
    await writeCloudConfig()
    expect((await resolved({ APP_ENV: 'staging', AWS_REGION: 'ca-central-1' })).region).toBe('ca-central-1')
  }, 60_000)
})
