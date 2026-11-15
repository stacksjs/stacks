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
    async function run(...args: string[]) {
      const child = Bun.spawn([process.execPath, '--no-env-file', cli, ...args], { cwd: root, env: { ...process.env, CI: '1', APP_ENV: 'test' }, stdout: 'pipe', stderr: 'pipe' })
      const [output, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      return { output, error, code }
    }
    expect((await run('workflow:setup')).code).toBe(0)
    expect((await run('workflow:setup', '--check')).code).toBe(0)
    writeFileSync(join(root, '.reviewos/workflows/ci.yml'), '# edited workflow')
    const stale = await run('workflow:setup', '--check')
    expect(stale.code).not.toBe(0)
    expect(stale.output + stale.error).toContain('Regenerate')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})
