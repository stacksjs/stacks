import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { publicationEnvironment } from '../../actions/tests/helpers/publication-environment'

function git(root: string, ...args: string[]) {
  const result = Bun.spawnSync(['git', '-C', root, ...args], { stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}

function iosFixture(root: string) {
  mkdirSync(join(root, 'config'))
  writeFileSync(join(root, 'config/mobile.ts'), 'export default { ios: { version: "1.0.0" } }')
  const tool = join(root, 'pantry/github.com/yonaskolb/XcodeGen/v2.46.0')
  mkdirSync(join(tool, 'bin'), { recursive: true })
  mkdirSync(join(tool, 'share/xcodegen/SettingPresets'), { recursive: true })
  writeFileSync(join(tool, 'share/xcodegen/SettingPresets/base.yml'), '')
  writeFileSync(join(tool, 'bin/xcodegen'), '')
  git(root, 'init', '--initial-branch=main')
  git(root, 'config', 'user.name', 'Publication Fixture')
  git(root, 'config', 'user.email', 'fixture@example.test')
  git(root, 'add', 'config', 'package.json', 'policy.ts')
  git(root, 'commit', '-qm', 'fixture')
}

async function command(args: string[], setup?: (root: string) => void) {
  const checkout = resolve(import.meta.dir, '../../../../..')
  const root = mkdtempSync(join(tmpdir(), 'buddy-publication-entry-'))
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { 'publication:check': 'bun policy.ts' } }))
    writeFileSync(join(root, 'policy.ts'), 'await Bun.write("policy-ran", process.env.STACKS_PUBLICATION_CHANNEL!); process.exit(9)')
    setup?.(root)
    const head = existsSync(join(root, '.git')) ? git(root, 'rev-parse', 'HEAD') : undefined
    const runner = join(root, 'buddy.ts')
    writeFileSync(runner, `import { cli } from ${JSON.stringify(join(checkout, 'storage/framework/core/cli/src/index.ts'))}
import { release } from ${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/release.ts'))}
import { deploy } from ${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/deploy.ts'))}
globalThis.fetch = async () => { throw new Error('No external requests are permitted in this isolated publication fixture') }
const buddy = cli('buddy')
release(buddy)
deploy(buddy)
await buddy.parse()
`)
    const child = Bun.spawn([
      process.execPath, '--no-env-file', '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'), runner, ...args,
    ], { cwd: root, env: { ...publicationEnvironment(), GIT_TRACE: join(root, 'git-trace.log') }, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return {
      code, output: `${stdout}\n${stderr}`, ran: existsSync(join(root, 'policy-ran')),
      trace: existsSync(join(root, 'git-trace.log')) ? readFileSync(join(root, 'git-trace.log'), 'utf8') : '',
      head, finalHead: head ? git(root, 'rev-parse', 'HEAD') : undefined,
    }
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}

for (const args of [
  ['deploy'], ['deploy:preview', 'policy-fixture'], ['release:ios'], ['release:github', 'fixture-tag'],
]) {
  test(`the direct Buddy ${args[0]} command blocks publication policy failure`, async () => {
    const result = await command(args)
    expect(result.code, result.output).not.toBe(0)
    expect(result.output).toContain('publication:check failed with exit code 9')
    expect(result.ran).toBe(true)
  }, 15_000)
}

test('iOS dry-run inspects local source without pulling, fetching, building or changing refs', async () => {
  const result = await command(['release:ios', '--dry-run', '--skip-github-release'], iosFixture)
  expect(result.code, result.output).toBe(0)
  expect(result.ran).toBe(false)
  expect(result.finalHead).toBe(result.head)
  expect(result.trace).not.toMatch(/built-in: git (?:pull|fetch|add|commit|push|tag -a)/)
  expect(result.output).toContain('v1.0.0-build.1')
}, 15_000)

test('iOS release rechecks policy after pulling newer source', async () => {
  const result = await command(['release:ios', '--skip-github-release'], (root) => {
    writeFileSync(join(root, 'policy.ts'), 'await Bun.write("policy-ran", "initial policy passed")')
    iosFixture(root)
    // A local bare remote advertises a newer main whose policy refuses release.
    const remote = join(root, 'remote.git')
    git(root, 'clone', '--bare', root, remote)
    const old = git(root, 'rev-parse', 'HEAD')
    writeFileSync(join(root, 'policy.ts'), 'await Bun.write("policy-ran", "new policy refused"); process.exit(9)')
    git(root, 'add', 'policy.ts')
    git(root, 'commit', '-qm', 'restricted content')
    git(root, 'push', remote, 'main')
    git(root, 'reset', '--hard', old)
    git(root, 'remote', 'add', 'origin', remote)
  })
  expect(result.code, result.output).not.toBe(0)
  expect(result.finalHead).not.toBe(result.head)
  expect(result.output).toContain('publication:check failed with exit code 9')
  expect(result.trace).toContain('git pull')
  expect(result.trace).not.toMatch(/built-in: git (?:add|commit|push|tag -a)/)
}, 20_000)

test.each(['release:ios', 'release:github'])('%s dry-run does not execute an application publication script', async (name) => {
  const result = await command([name, '--dry-run'])
  expect(result.ran).toBe(false)
  expect(result.output).not.toContain('publication:check failed')
}, 15_000)
