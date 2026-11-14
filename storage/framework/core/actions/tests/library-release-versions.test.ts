import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'

// Public planning and existing-archive publication catch version-policy errors;
// the owned loopback transport does not qualify public npm build metadata.
async function versions(mode: 'plan' | 'publish', version = '2.0.0') {
  const root = await mkdtemp(join(tmpdir(), 'stacks-library-versions-'))
  try {
    const home = join(root, 'home')
    await mkdir(home)
    await writeFile(join(home, '.gitconfig'), '')
    await mkdir(join(root, 'config'))
    await mkdir(join(root, 'resources/functions'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'release-version-fixture', version: '1.0.0', type: 'module' }))
    await writeFile(join(root, 'config/library.ts'), `export default { repository: 'fixture/libraries', release: { publisher: 'bun' }, packages: [{ name: '@fixture/math', registry: 'npm', version: ${JSON.stringify(version)} }] }`)
    await writeFile(join(root, 'resources/functions/add.ts'), 'export const add = (a: number, b: number): number => a + b')
    await writeFile(join(root, 'bunfig.toml'), 'preload = []\n')
    for (const args of [['init', '--quiet'], ['config', 'user.name', 'Fixture'], ['config', 'user.email', 'fixture@example.invalid'], ['add', '.'], ['commit', '--quiet', '-m', 'test: version fixture']]) {
      expect(Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' }).exitCode).toBe(0)
    }
    const child = spawnOwnedProcess([process.execPath, join(import.meta.dir, 'fixtures/native-library-versions.ts'), mode], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
      stopGraceMs: 0,
      env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, SYSTEMROOT: process.env.SYSTEMROOT,
        HOME: home, NPM_CONFIG_USERCONFIG: join(home, '.npmrc'), NPM_CONFIG_CACHE: join(home, 'npm-cache'),
        APP_ENV: 'test', NODE_ENV: 'test', BUN_OPTIONS: '', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(home, '.gitconfig') },
    })
    const timer = setTimeout(() => { void child.stop() }, 25_000)
    try {
      const [out, err, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(exit.code, `${out}\n${err}`).toBe(0)
      return JSON.parse(out.trim())
    }
    finally { clearTimeout(timer); await child.stop() }
  }
  finally { await rm(root, { recursive: true, force: true }) }
}

test('pinned published versions determine the channel for equivalent root prerelease selections', async () => {
  const result = await versions('plan')
  expect(result.byType).toEqual(result.byVersion)
  expect(result.byType).toEqual({ version: '2.0.0', tag: 'latest' })
  expect(result.requiredChannels).toEqual([true, true, true])
  expect(result.allowedPrerelease.tag).toBe('beta')
  expect(result.allowedPrerelease.packages.map((pkg: { version: string }) => pkg.version)).toEqual(['2.0.0', '1.1.0-beta.0'])
}, 30_000)

test.each(['1.2.3+buildabc', '1.2.3+build-abc'])('stable build metadata %s reaches exact existing-archive verification', async (version) => {
  const result = await versions('publish', version)
  expect(result).toEqual({ version, tag: 'latest', status: 'existing-identical', gets: 3, writes: 0 })
}, 30_000)
