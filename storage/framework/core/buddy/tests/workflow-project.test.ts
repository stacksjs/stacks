import { expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runWorkflowStep, writeProjectWorkflow, workflowReleaseIdentity } from '../src/workflow-project'

test('normal workflow steps run application argv without a shell and accept only the downloaded archive', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-workflow-app-'))
  try {
    mkdirSync(join(root, 'config'))
    mkdirSync(join(root, 'storage/received'), { recursive: true })
    writeFileSync(join(root, 'storage/received/App.app.zip'), 'owned downloaded artifact')
    const config = { provider: 'reviewos', origin: 'https://reviewos.org', repository: 'owner/app', runners: { checks: ['self-hosted', 'linux'], ios: ['self-hosted', 'macos'] }, commands: { 'native-build': [[process.execPath, '-e', 'void 0']], 'native-accept': [[process.execPath, '-e', 'await Bun.write("accepted.json",JSON.stringify(process.argv.slice(1)))', '{artifact}', 'literal $(do-not-run)']] }, native: { artifacts: ['storage/generated/*.zip'], downloadDirectory: 'storage/received', archivePattern: '**/*.app.zip' } }
    writeFileSync(join(root, 'config/workflows.ts'), `export default ${JSON.stringify(config)}`)
    await runWorkflowStep(root, 'native-accept')
    expect(JSON.parse(readFileSync(join(root, 'accepted.json'), 'utf8'))).toEqual([join(root, 'storage/received/App.app.zip'), 'literal $(do-not-run)'])
    writeProjectWorkflow(root, config as any)
    expect(readFileSync(join(root, '.reviewos/workflows/ci.yml'), 'utf8')).toContain('./buddy workflow:step native-accept')
    writeFileSync(join(root, '.reviewos/workflows/ci.yml'), 'name: owned custom workflow')
    expect(() => writeProjectWorkflow(root, config as any)).toThrow('already exists')
    writeFileSync(join(root, 'storage/received/Other.app.zip'), 'second archive')
    await expect(runWorkflowStep(root, 'native-accept')).rejects.toThrow('exactly one')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})

test('release identity comes from its version manifest and rejects unsafe inputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-workflow-release-'))
  try {
    writeFileSync(join(root, 'product.json'), JSON.stringify({ version: '1.2.3', build: 7 }))
    expect(workflowReleaseIdentity(root, { versionFile: 'product.json' })).toEqual({ version: '1.2.3', build: 7, tag: 'v1.2.3-build.7' })
    writeFileSync(join(root, 'product.json'), JSON.stringify({ version: '1.2.3', build: 'not-a-number' }))
    expect(() => workflowReleaseIdentity(root, { versionFile: 'product.json' })).toThrow()
    symlinkSync('/etc/hosts', join(root, 'outside.json'))
    expect(() => workflowReleaseIdentity(root, { versionFile: 'outside.json' })).toThrow()
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})

test('the actual Buddy CLI generates and checks application workflows', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-workflow-cli-'))
  try {
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'package.json'), '{}')
    writeFileSync(join(root, 'bunfig.toml'), 'preload = []')
    writeFileSync(join(root, 'config/workflows.ts'), 'export default { provider: "reviewos", origin: "https://reviewos.org", repository: "owner/app", runners: { checks: ["self-hosted", "linux"] } }')
    const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
    async function run(args: string[], preload?: string) {
      const child = Bun.spawn([process.execPath, '--no-env-file', ...(preload ? ['--preload', preload] : []), cli, ...args], { cwd: root, env: { ...process.env, CI: '1', APP_ENV: 'test' }, stdout: 'pipe', stderr: 'pipe' })
      const [output, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      return { output, error, code }
    }
    expect((await run(['workflow:setup'])).code).toBe(0)
    expect((await run(['workflow:setup', '--check'])).code).toBe(0)
    writeFileSync(join(root, '.reviewos/workflows/ci.yml'), '# edited workflow')
    const stale = await run(['workflow:setup', '--check'])
    expect(stale.code).not.toBe(0)
    expect(stale.output + stale.error).toContain('Regenerate')
    const delay = join(root, 'delay-workflow.ts')
    writeFileSync(delay, String.raw`
Bun.plugin({
  name: 'slow-workflow-command-fixture',
  setup(build) {
    build.onLoad({ filter: /[\\/]commands[\\/]workflow\.ts$/ }, async ({ path }) => {
      await Bun.sleep(5300)
      return { contents: await Bun.file(path).text(), loader: 'ts' }
    })
  },
})
`)
    const nonNative = await run(['workflow:check-credentials', 'native-accept'], delay)
    expect(nonNative.code).not.toBe(0)
    expect(nonNative.output + nonNative.error).toContain('Configure a native workflow')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 30000)

test('the actual workflow credential check detects missing native inputs without exposing configured values', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-workflow-credentials-'))
  const names = ['WORKFLOW_FIXTURE_SIGNING', 'WORKFLOW_FIXTURE_PREVIEW_USER', 'WORKFLOW_FIXTURE_PREVIEW_PASSWORD', 'WORKFLOW_FIXTURE_ATHLETE']
  try {
    mkdirSync(join(root, 'config'))
    writeFileSync(join(root, 'package.json'), '{}')
    writeFileSync(join(root, 'bunfig.toml'), 'preload = []')
    const config = {
      provider: 'reviewos', origin: 'https://reviewos.org', repository: 'owner/app',
      runners: { checks: ['self-hosted', 'linux'], ios: ['self-hosted', 'macos'] },
      commands: Object.fromEntries(['native-build', 'native-accept', 'native-sign', 'native-upload', 'native-verify', 'native-cleanup'].map(step => [step, [[process.execPath, '-e', 'await Bun.write("executed.txt", "unexpected")']]])),
      secrets: { ios: names },
      stepSecrets: { 'native-accept': [names[3]], 'native-sign': [names[0]], 'native-verify': [names[1], names[2]] },
      native: { artifacts: ['storage/out/*.zip'], downloadDirectory: 'storage/in', archivePattern: '*.zip' },
      release: { versionFile: 'product.json' },
    }
    writeFileSync(join(root, 'config/workflows.ts'), `export default ${JSON.stringify(config)}`)
    const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
    async function run(args: string[], supplied: Record<string, string> = {}) {
      const env = { ...process.env, CI: '1', APP_ENV: 'test', ...supplied }
      for (const name of names) if (!(name in supplied)) delete env[name]
      const child = Bun.spawn([process.execPath, '--no-env-file', cli, ...args], { cwd: root, env, stdout: 'pipe', stderr: 'pipe' })
      const [output, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      return { text: output + error, code }
    }
    const missing = await run(['workflow:check-credentials', 'native-release'])
    expect(missing.code).not.toBe(0)
    expect(missing.text).toContain('WORKFLOW_FIXTURE_PREVIEW_PASSWORD')
    expect(missing.text).toContain('ios-testflight')
    const partial = await run(['workflow:check-credentials', 'native-release'], { [names[0]!]: 'fixture-private-value-no-log', [names[1]!]: 'reviewer', [names[2]!]: '   ' })
    expect(partial.code).not.toBe(0)
    expect(partial.text).not.toContain('fixture-private-value-no-log')
    expect(partial.text).not.toContain('reviewer')
    const configured = await run(['workflow:check-credentials', 'native-release'], { [names[0]!]: 'fixture-private-value-no-log', [names[1]!]: 'reviewer', [names[2]!]: 'fixture-preview-value-no-log' })
    expect(configured.code).toBe(0)
    expect(configured.text).not.toContain('fixture-private-value-no-log')
    expect(configured.text).not.toContain('fixture-preview-value-no-log')
    expect((await run(['workflow:check-credentials', 'native-accept'], { [names[3]!]: 'synthetic-athlete' })).code).toBe(0)
    const step = await run(['workflow:step', 'native-verify'])
    expect(step.code).not.toBe(0)
    expect(step.text).toContain('WORKFLOW_FIXTURE_PREVIEW_PASSWORD')
    expect(await Bun.file(join(root, 'executed.txt')).exists()).toBe(false)
    expect((await run(['workflow:check-credentials', 'unknown'])).code).not.toBe(0)
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 30000)
