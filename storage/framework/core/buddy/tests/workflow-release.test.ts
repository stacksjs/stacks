import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commitWorkflowRelease, evaluateProjectWorkflow, nextWorkflowRelease, requireQualifiedWorkflow, waitForWorkflowRelease } from '../src/workflow-release'
import { writeWorkflowReleaseState } from '../src/workflow-project'
import { renderReviewOsWorkflow } from '../src/workflow-template'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stacks-workflow-git-'))
  const config = { provider: 'reviewos' as const, origin: 'https://reviewos.org', repository: 'owner/app', runners: { checks: ['self-hosted', 'linux'], ios: ['self-hosted', 'macos'] }, commands: Object.fromEntries(['native-build', 'native-accept', 'native-sign', 'native-upload', 'native-verify', 'native-cleanup'].map(step => [step, [['bun', 'run', step]]])), native: { artifacts: ['storage/out/*.zip'], downloadDirectory: 'storage/in', archivePattern: '*.zip' }, release: { versionFile: 'product.json' } }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  mkdirSync(join(root, 'config'))
  mkdirSync(join(root, '.reviewos/workflows'), { recursive: true })
  writeFileSync(join(root, 'config/workflows.ts'), `export default ${JSON.stringify(config)}`)
  writeFileSync(join(root, 'package.json'), '{"version":"1.0.0-build.35"}')
  writeFileSync(join(root, 'product.json'), '{"version":"1.0.0","build":35}')
  const source = renderReviewOsWorkflow(config)
  writeFileSync(join(root, '.reviewos/workflows/ci.yml'), source)
  git('init', '-b', 'main'); git('config', 'user.name', 'Workflow Fixture'); git('config', 'user.email', 'workflow@example.test')
  git('add', '.'); git('commit', '-m', 'chore: prepared app')
  const workflow = Bun.YAML.parse(source) as any
  const run: any = { number: 7, state: 'succeeded', trusted: true, event: 'push', head_sha: git('rev-parse', 'HEAD'), ref: 'refs/heads/main', workflow: { path: '.reviewos/workflows/ci.yml', owner_defined: false }, version: { path: '.reviewos/workflows/ci.yml', digest: createHash('sha256').update(source).digest('hex') }, jobs: Object.entries(workflow.jobs).map(([job_id, definition]: [string, any]) => ({ job_id, state: 'succeeded', runner: 'owned-1', started_at: '2026-11-15T20:00:00Z', finished_at: '2026-11-15T20:01:00Z', resume_from_step: null, runs_on: definition['runs-on'], steps: definition.steps.map((step: any) => ({ name: step.name, state: step.if && step.if !== 'always()' ? 'skipped' : 'succeeded', exit_code: step.if && step.if !== 'always()' ? null : 0, started_at: '2026-11-15T20:00:00Z', finished_at: '2026-11-15T20:01:00Z', reused_from_attempt: null })) })) }
  return { root, config, git, run }
}

test('native release inputs are checked before building, with credentials confined to their preflight', () => {
  const { root, config } = fixture()
  try {
    const workflow = Bun.YAML.parse(renderReviewOsWorkflow({
      ...config,
      secrets: { ios: ['ATHLETE_FIXTURE', 'SIGNING_KEY', 'PREVIEW_USER', 'PREVIEW_PASSWORD'] },
      stepSecrets: { 'native-accept': ['ATHLETE_FIXTURE'], 'native-sign': ['SIGNING_KEY'], 'native-verify': ['PREVIEW_USER', 'PREVIEW_PASSWORD'] },
    })) as any
    const native = workflow.jobs.native
    const identity = native.steps.find((step: any) => step.id === 'release')
    expect(identity.env.WORKFLOW_UPLOAD_REQUESTED).toBe('${{ inputs.upload }}')
    const acceptance = native.steps.findIndex((step: any) => step.run === './buddy workflow:check-credentials native-accept')
    const release = native.steps.findIndex((step: any) => step.run === './buddy workflow:check-credentials native-release')
    const build = native.steps.findIndex((step: any) => step.run === './buddy workflow:step native-build')
    expect(acceptance).toBeGreaterThan(-1)
    expect(release).toBeGreaterThan(acceptance)
    expect(build).toBeGreaterThan(release)
    expect(native.steps[acceptance].env).toEqual({ ATHLETE_FIXTURE: '${{ secrets.ATHLETE_FIXTURE }}' })
    expect(native.steps[release].if).toBe("steps.release.outputs.upload == 'true'")
    expect(native.steps[release].env).toEqual({ SIGNING_KEY: '${{ secrets.SIGNING_KEY }}', PREVIEW_USER: '${{ secrets.PREVIEW_USER }}', PREVIEW_PASSWORD: '${{ secrets.PREVIEW_PASSWORD }}' })
    expect(native.steps[build].env).toBeUndefined()
    expect(native.env.SIGNING_KEY).toBeUndefined()
    expect(native.env.PREVIEW_PASSWORD).toBeUndefined()
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})

test('release preflight requires actual full source acceptance, before allocating another build', async () => {
  const { root, config, git, run } = fixture()
  try {
    expect(evaluateProjectWorkflow(root, config, run)).toBe('accepted')
    expect(() => evaluateProjectWorkflow(root, config, run, true)).toThrow('Required step')
    git('tag', 'v1.0.0-build.39')
    expect(nextWorkflowRelease(root, config, 'build')).toEqual({ version: '1.0.0', build: 40, tag: 'v1.0.0-build.40' })
    expect(nextWorkflowRelease(root, config, 'minor').build).toBe(40)
    const client = { runs: async () => [{ number: 7 }], run: async () => run } as any
    expect(await requireQualifiedWorkflow(root, config, client)).toBe(7)
    run.state = 'running'
    await expect(requireQualifiedWorkflow(root, config, client)).rejects.toThrow('pending')
    expect(readFileSync(join(root, 'product.json'), 'utf8')).toContain('"build":35')
    run.state = 'succeeded'; run.jobs[0].steps[0].reused_from_attempt = 1
    expect(() => evaluateProjectWorkflow(root, config, run)).toThrow('Required step')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})

test('release upload uses the real tag and checkout, including detached CI checkouts', async () => {
  const { root, git } = fixture()
  const previous = { output: process.env.GITHUB_OUTPUT, ref: process.env.GITHUB_REF, requested: process.env.WORKFLOW_UPLOAD_REQUESTED }
  try {
    process.env.GITHUB_OUTPUT = join(root, 'step-output')
    process.env.GITHUB_REF = 'refs/heads/main'
    process.env.WORKFLOW_UPLOAD_REQUESTED = 'false'
    expect(await writeWorkflowReleaseState(root)).toBe(false)
    expect(readFileSync(process.env.GITHUB_OUTPUT, 'utf8')).toBe('upload=false\n')
    writeFileSync(process.env.GITHUB_OUTPUT, '')
    process.env.WORKFLOW_UPLOAD_REQUESTED = 'true'
    await expect(writeWorkflowReleaseState(root)).rejects.toThrow('release tag')
    git('tag', 'v1.0.0-build.35'); git('checkout', '--detach', 'HEAD')
    expect(await writeWorkflowReleaseState(root)).toBe(true)
    expect(readFileSync(process.env.GITHUB_OUTPUT, 'utf8')).toBe('upload=true\n')
    process.env.GITHUB_REF = 'refs/heads/topic'
    await expect(writeWorkflowReleaseState(root)).rejects.toThrow('release tag')
    process.env.GITHUB_REF = 'refs/heads/main'
    writeFileSync(join(root, 'package.json'), '{"version":"1.0.0-build.35","dependencies":{}}')
    await expect(writeWorkflowReleaseState(root)).rejects.toThrow('package.json')
    writeFileSync(join(root, 'product.json'), '{"version":"1.0.0","build":36}')
    await expect(writeWorkflowReleaseState(root)).rejects.toThrow()
  }
  finally {
    for (const [key, value] of Object.entries({ GITHUB_OUTPUT: previous.output, GITHUB_REF: previous.ref, WORKFLOW_UPLOAD_REQUESTED: previous.requested })) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    rmSync(root, { recursive: true, force: true })
  }
})

test('release waiting keeps verifying its original commit after main advances', async () => {
  const { root, config, git, run } = fixture()
  try {
    const release = run.head_sha
    for (const job of run.jobs) {
      for (const step of job.steps) Object.assign(step, { state: 'succeeded', exit_code: 0 })
    }
    const client = {
      runs: async (_workflow: string, { sha }: { sha: string }) => {
        expect(sha).toBe(release)
        writeFileSync(join(root, 'README.md'), 'Documentation refreshed.\n')
        git('add', 'README.md')
        git('commit', '-m', 'docs: refresh the screenshots')
        expect(git('rev-parse', 'HEAD')).not.toBe(release)
        return [{ number: 7 }]
      },
      run: async () => run,
    } as any
    expect(await waitForWorkflowRelease(root, config, 0, client)).toBe(7)
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})

test('release waiting resumes after an interrupted status read for the same source', async () => {
  const { root, config, run } = fixture()
  try {
    for (const job of run.jobs) {
      for (const step of job.steps) Object.assign(step, { state: 'succeeded', exit_code: 0 })
    }
    let reads = 0
    const client = {
      runs: async (_workflow: string, { sha }: { sha: string }) => {
        expect(sha).toBe(run.head_sha)
        return [run]
      },
      run: async (number: number) => {
        expect(number).toBe(run.number)
        if (++reads === 1) throw Object.assign(new Error('Unable to connect'), { code: 'ECONNREFUSED' })
        return run
      },
    } as any
    expect(await waitForWorkflowRelease(root, config, 1, client)).toBe(7)
    expect(reads).toBe(2)
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 20000)

test('release waiting keeps the last interruption at the deadline and surfaces permanent errors immediately', async () => {
  const { root, config, run } = fixture()
  try {
    const unavailable = new Error('ReviewOS workflow request blocked: Metadata API returned HTTP 503')
    const refused = new Error('ReviewOS workflow request blocked: Metadata API returned HTTP 401')
    const unavailableClient = { runs: async () => { throw unavailable } } as any
    const refusedClient = { runs: async () => { throw refused } } as any
    const failedClient = { runs: async () => [run], run: async () => ({ ...run, state: 'failed' }) } as any
    await expect(waitForWorkflowRelease(root, config, 0, unavailableClient)).rejects.toMatchObject({ cause: unavailable })
    await expect(waitForWorkflowRelease(root, config, 1, refusedClient)).rejects.toBe(refused)
    await expect(waitForWorkflowRelease(root, config, 1, failedClient)).rejects.toThrow('failed')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})

test('a normal workflow release atomically publishes aligned metadata, notes and its immutable tag', () => {
  const { root, config, git } = fixture()
  try {
    const remote = join(root, 'remote.git')
    git('init', '--bare', remote)
    git('remote', 'add', 'origin', remote)
    git('push', 'origin', 'main')
    mkdirSync(join(root, 'notes'))
    writeFileSync(join(root, 'notes/en-US.txt'), 'Test workout comments.\n')
    git('add', 'notes/en-US.txt')
    const identity = nextWorkflowRelease(root, config, 'build')
    commitWorkflowRelease(root, config, identity, ['notes/en-US.txt'])
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).toBe('1.0.0-build.36')
    expect(JSON.parse(readFileSync(join(root, 'product.json'), 'utf8')).build).toBe(36)
    expect(git('log', '-1', '--format=%s')).toBe('chore(release): v1.0.0-build.36')
    expect(git('rev-parse', 'refs/tags/v1.0.0-build.36^{commit}')).toBe(git('rev-parse', 'HEAD'))
    expect(git('ls-remote', 'origin', 'refs/heads/main')).toContain(git('rev-parse', 'HEAD'))
    expect(git('ls-remote', 'origin', 'refs/tags/v1.0.0-build.36^{}')).toContain(git('rev-parse', 'HEAD'))
    expect(git('status', '--porcelain', '--untracked-files=no')).toBe('')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})
