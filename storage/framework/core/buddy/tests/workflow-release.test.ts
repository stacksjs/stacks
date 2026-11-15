import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { evaluateProjectWorkflow, nextWorkflowRelease, requireQualifiedWorkflow } from '../src/workflow-release'
import { writeWorkflowReleaseState } from '../src/workflow-project'
import { renderReviewOsWorkflow } from '../src/workflow-template'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stacks-workflow-git-'))
  const config = { provider: 'reviewos' as const, origin: 'https://reviewos.org', repository: 'owner/app', runners: { checks: ['self-hosted', 'linux'], ios: ['self-hosted', 'macos'] }, commands: Object.fromEntries(['native-build', 'native-accept', 'native-sign', 'native-upload', 'native-verify', 'native-cleanup'].map(step => [step, [['bun', 'run', step]]])), native: { artifacts: ['storage/out/*.zip'], downloadDirectory: 'storage/in', archivePattern: '*.zip' }, release: { versionFile: 'product.json' } }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  mkdirSync(join(root, 'config'))
  mkdirSync(join(root, '.reviewos/workflows'), { recursive: true })
  writeFileSync(join(root, 'config/workflows.ts'), `export default ${JSON.stringify(config)}`)
  writeFileSync(join(root, 'product.json'), '{"version":"1.0.0","build":35}')
  const source = renderReviewOsWorkflow(config)
  writeFileSync(join(root, '.reviewos/workflows/ci.yml'), source)
  git('init', '-b', 'main'); git('config', 'user.name', 'Workflow Fixture'); git('config', 'user.email', 'workflow@example.test')
  git('add', '.'); git('commit', '-m', 'chore: prepared app')
  const workflow = Bun.YAML.parse(source) as any
  const run: any = { number: 7, state: 'succeeded', trusted: true, event: 'push', head_sha: git('rev-parse', 'HEAD'), ref: 'refs/heads/main', workflow: { path: '.reviewos/workflows/ci.yml', owner_defined: false }, version: { path: '.reviewos/workflows/ci.yml', digest: createHash('sha256').update(source).digest('hex') }, jobs: Object.entries(workflow.jobs).map(([job_id, definition]: [string, any]) => ({ job_id, state: 'succeeded', runner: 'owned-1', started_at: '2026-11-15T20:00:00Z', finished_at: '2026-11-15T20:01:00Z', resume_from_step: null, runs_on: definition['runs-on'], steps: definition.steps.map((step: any) => ({ name: step.name, state: step.if && step.if !== 'always()' ? 'skipped' : 'succeeded', exit_code: step.if && step.if !== 'always()' ? null : 0, started_at: '2026-11-15T20:00:00Z', finished_at: '2026-11-15T20:01:00Z', reused_from_attempt: null })) })) }
  return { root, config, git, run }
}

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
    process.env.WORKFLOW_UPLOAD_REQUESTED = 'true'
    await expect(writeWorkflowReleaseState(root)).rejects.toThrow('release tag')
    git('tag', 'v1.0.0-build.35'); git('checkout', '--detach', 'HEAD')
    expect(await writeWorkflowReleaseState(root)).toBe(true)
    expect(readFileSync(process.env.GITHUB_OUTPUT, 'utf8')).toBe('upload=true\n')
    process.env.GITHUB_REF = 'refs/heads/topic'
    await expect(writeWorkflowReleaseState(root)).rejects.toThrow('release tag')
    process.env.GITHUB_REF = 'refs/heads/main'
    writeFileSync(join(root, 'product.json'), '{"version":"1.0.0","build":36}')
    await expect(writeWorkflowReleaseState(root)).rejects.toThrow()
  }
  finally {
    for (const [key, value] of Object.entries({ GITHUB_OUTPUT: previous.output, GITHUB_REF: previous.ref, WORKFLOW_UPLOAD_REQUESTED: previous.requested })) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    rmSync(root, { recursive: true, force: true })
  }
})
