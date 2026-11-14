import { expect, test } from 'bun:test'
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Public Buddy commands prove config loading and orchestration in a generic app;
// provider transports are exercised separately, without registry credentials.
const cli = resolve(import.meta.dir, '../../buddy/src/cli.ts')
async function app(config: string, args: string[], env: Record<string, string> = {}, localPush = false, sourceWorkflow = true, upstream = 'main') {
  const root = await mkdtemp(join(tmpdir(), 'stacks-buddy-release-'))
  try {
    await mkdir(join(root, 'config'), { recursive: true })
    if (sourceWorkflow) await cp(resolve(import.meta.dir, '../../../defaults/vcs/github'), join(root, '.github'), { recursive: true })
    await mkdir(join(root, 'resources/functions'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'generic-app', version: '1.0.0', type: 'module' }))
    await writeFile(join(root, 'config/library.ts'), `export default ${config}`)
    await writeFile(join(root, 'resources/functions/add.ts'), 'export const add = (a: number, b: number): number => a + b')
    for (const command of [['init', '--quiet'], ['config', 'user.name', 'Fixture'], ['config', 'user.email', 'fixture@example.invalid'], ['add', '.'], ['commit', '--quiet', '-m', 'test: seed app']]) {
      const result = Bun.spawnSync(['git', ...command], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
      if (result.exitCode) throw new Error(result.stderr.toString())
    }
    if (localPush) {
      const bare = join(root, '.release-remote.git')
      for (const args of [['init', '--bare', '--quiet', bare], ['remote', 'add', 'origin', bare], ['push', '--quiet', '--set-upstream', 'origin', `HEAD:${upstream}`]]) {
        const result = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
        if (result.exitCode) throw new Error(result.stderr.toString())
      }
    }
    const child = Bun.spawn([process.execPath, cli, ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, APP_ENV: 'test', ...env } })
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    const candidatePath = join(root, 'storage/framework/runtime/library-release/candidate.json')
    const record = await Bun.file(candidatePath).exists() ? await Bun.file(candidatePath).json() : undefined
    return { record, pushedTag: localPush ? Bun.spawnSync(['git', '--git-dir', join(root, '.release-remote.git'), 'rev-parse', '--verify', 'refs/tags/v1.0.1'], { cwd: root, stdout: 'pipe', stderr: 'pipe' }).stdout.toString().trim() : undefined, output: out + err, code, manifest: await Bun.file(join(root, 'package.json')).json(), candidate: await Bun.file(join(root, 'storage/framework/runtime/library-release/candidate.json')).exists() }
  }
  finally { await rm(root, { recursive: true, force: true }) }
}

test('normal Buddy release dry-run validates library plan before any bump or generated file', async () => {
  const result = await app(`{ repository: 'fixture/libraries', packages: [{ name: '@fixture/math', registry: 'npm', version: '1.2.0-alpha.1' }] }`, ['release', '--bump', 'patch', '--dry-run'])
  expect(result.code).not.toBe(0)
  expect(result.output).toContain('distribution tag')
  expect(result.manifest.version).toBe('1.0.0')
  expect(result.candidate).toBe(false)
}, 30_000)


test('Buddy prepare is a no-op for disabled, private-only and unmatched legacy libraries', async () => {
  for (const config of [
    (await readFile(resolve(import.meta.dir, '../../../defaults/scaffold/config/library.ts'), 'utf8')).replace(/^import .*\n/m, '').replace('export default ', '').replace(' satisfies LibraryConfig', '').replaceAll('__APP_SLUG__', 'generic-app').replaceAll('__APP_TAG_PREFIX__', 'generic'),
    `{ releaseable: false, packages: [{ name: '@fixture/math' }] }`,
    `{ packages: [{ name: '@fixture/private', private: true }] }`,
    `{ functions: { name: '@fixture/missing', files: ['absent'] }, webComponents: {} }`,
    `{ packages: [{ name: '@fixture/missing', include: ['absent.ts'] }] }`,
  ]) {
    const result = await app(config, ['release:prepare'])
    expect(result.code).toBe(0)
    expect(result.output).toContain('"prepared":false')
    expect(result.candidate).toBe(false)
  }
}, 30_000)

test('Buddy prepare dry-run validates the configured plan without writing candidate files', async () => {
  const result = await app(`{ repository: 'fixture/libraries', release: { distTag: 'alpha', publisher: 'bun' }, packages: [{ name: '@fixture/math', registry: 'npm', version: '1.2.0-alpha.1' }] }`, ['release:prepare', '--dry-run'])
  expect(result.code).toBe(0)
  expect(result.output).toContain('"prepared":false')
  expect(result.candidate).toBe(false)
}, 30_000)

test('Buddy CI phase builds a function library once and retains source ownership and pinned version', async () => {
  const result = await app(`{ repository: 'fixture/libraries', release: { distTag: 'alpha', publisher: 'bun' }, packages: [{ name: '@fixture/math', registry: 'npm', version: '2.3.4-alpha.5' }] }`, ['release:prepare'], { GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_REF_NAME: 'main' })
  expect(result.code).toBe(0)
  expect(result.output).toContain('"prepared":true')
  expect(result.record.source.repository).toBe('fixture/libraries')
  expect(result.record.source.commit).toMatch(/^[a-f0-9]{40}$/)
  expect(result.record.packages[0].version).toBe('2.3.4-alpha.5')
  expect(result.record.packages[0].tag).toBe('alpha')
  expect(result.record.packages[0].archive.files['dist/index.js']).toBeDefined()
}, 30_000)

test('untagged main candidate reaches tag publication through exact source CI and original registry bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-native-tag-release-'))
  try {
    await mkdir(join(root, 'config'), { recursive: true })
    await mkdir(join(root, 'resources/functions'), { recursive: true })
    await mkdir(join(root, 'resources/components'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'generic-app', version: '1.0.0', type: 'module' }))
    await writeFile(join(root, 'config/library.ts'), `export default { repository: 'fixture/libraries', release: { distTag: 'alpha', publisher: 'bun' }, packages: [
      { name: '@fixture/math', registry: 'npm' },
      { name: '@fixture/components', registry: 'npm', kind: 'components', prefix: 'fixture-view', version: '3.1.0-beta.2' },
      { name: '@fixture/elements', registry: 'npm', kind: 'web-components', prefix: 'fixture', version: '2.0.0-alpha.3', prebuild: "bun -e \\"require('node:fs').appendFileSync('build-count', 'x')\\"" }
    ] }`)
    await writeFile(join(root, 'resources/functions/add.ts'), 'export const add = (a: number, b: number): number => a + b')
    await writeFile(join(root, 'resources/components/Badge.stx'), '<template><span>Fixture</span></template>')
    await writeFile(join(root, '.npmrc'), '//127.0.0.1/:_authToken=local-fixture-token\n')
    for (const args of [['init', '--quiet'], ['add', '.'], ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'test: source fixture']]) {
      expect(Bun.spawnSync(['git', ...args], { cwd: root }).exitCode).toBe(0)
    }
    const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/native-library-release.ts')], { cwd: root, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, BUN_AUTH_TOKEN: 'local-fixture-token' } })
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code, `${out}\n${err}`).toBe(0)
    expect(out).toContain('Native library tag lifecycle passed')
  }
  finally { await rm(root, { recursive: true, force: true }) }
}, 60_000)


test('normal Buddy release validates libraries then uses the existing Bump and atomic local Git push', async () => {
  const result = await app(`{ repository: 'fixture/libraries', release: { publisher: 'bun' }, packages: [{ name: '@fixture/math', registry: 'npm' }] }`, ['release', '--bump', 'patch'], {}, true)
  expect(result.code, result.output).toBe(0)
  expect(result.manifest.version).toBe('1.0.1')
  expect(result.pushedTag).toMatch(/^[a-f0-9]{40}$/)
  expect(result.output).toContain('Triggered CI/CD Release')
  expect(result.candidate).toBe(false)
}, 30_000)

test('interactive library version selection validates the chosen future channel before Bump can write', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-library-selection-'))
  try {
    await mkdir(join(root, 'resources/functions'), { recursive: true })
    await writeFile(join(root, 'resources/functions/add.ts'), 'export const value = 1')
    await writeFile(join(root, 'package.json'), '{"name":"generic-app","version":"1.0.0"}')
    const selection = join(import.meta.dir, '../src/library/release-selection.ts')
    const planning = join(import.meta.dir, '../src/library/release-plan.ts')
    const script = `
      import assert from 'node:assert/strict'
      const { selectNativeLibraryReleaseVersion } = await import(${JSON.stringify(selection)})
      const { planNativeLibraryRelease } = await import(${JSON.stringify(planning)})
      const config = { repository: 'fixture/libraries', packages: [{ name: '@fixture/math', registry: 'npm' }] }
      const bump = await selectNativeLibraryReleaseVersion({ cwd: process.cwd(), config, preid: 'beta', choose: async choices => choices.find(choice => choice.label.startsWith('preminor ')).value })
      assert.equal(bump, '1.1.0-beta.0')
      await assert.rejects(planNativeLibraryRelease({ cwd: process.cwd(), config, bump }), /distribution tag/)
      const plan = await planNativeLibraryRelease({ cwd: process.cwd(), config: { ...config, release: { distTag: 'beta' } }, bump })
      assert.equal(plan.packages[0].version, '1.1.0-beta.0')
      assert.equal(await selectNativeLibraryReleaseVersion({ cwd: process.cwd(), config: { ...config, releaseable: false }, choose: async () => { throw Error('must not prompt') } }), undefined)
      assert.equal((await Bun.file('package.json').json()).version, '1.0.0')
      console.log('Interactive selection validated before mutation')
    `
    const child = Bun.spawn([process.execPath, '-e', script], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code, `${out}\n${err}`).toBe(0)
    expect(out).toContain('Interactive selection validated before mutation')
  }
  finally { await rm(root, { recursive: true, force: true }) }
}, 30_000)


test('normal Buddy release refuses a missing source workflow before mutation', async () => {
  const result = await app(`{ repository: 'fixture/libraries', release: { publisher: 'bun' }, packages: [{ name: '@fixture/math', registry: 'npm' }] }`, ['release', '--bump', 'patch', '--dry-run'], {}, false, false)
  expect(result.code).not.toBe(0)
  expect(result.output).toContain('Source CI workflow .github/workflows/ci.yml is not installed')
  expect(result.manifest.version).toBe('1.0.0')
  expect(result.candidate).toBe(false)
}, 30_000)


test('Buddy prepares actual codex branch builds without making them publication sources', async () => {
  const result = await app(`{ repository: 'fixture/libraries', release: { publisher: 'bun' }, packages: [{ name: '@fixture/math', registry: 'npm' }] }`, ['release:prepare'], { GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_REF_NAME: 'codex/qualify' })
  expect(result.code, result.output).toBe(0)
  expect(result.output).toContain('"prepared":true')
  expect(result.output).toContain('"source_eligible":false')
  expect(result.record.source.commit).toMatch(/^[a-f0-9]{40}$/)
}, 30_000)


test('normal Buddy library release refuses a non-source upstream before bump, tag or push', async () => {
  const config = `{ repository: 'fixture/libraries', release: { publisher: 'bun' }, packages: [{ name: '@fixture/math', registry: 'npm' }] }`
  const result = await app(config, ['release', '--bump', 'patch'], {}, true, true, 'codex/feature')
  expect(result.code).not.toBe(0)
  expect(result.output).toContain('Release requires upstream branch refs/heads/main')
  expect(result.manifest.version).toBe('1.0.0')
  expect(result.pushedTag).toBe('')
  expect(result.candidate).toBe(false)
}, 30_000)
