import { expect, test } from 'bun:test'
import { resolve } from 'node:path'

test('published root and narrow input entrypoints share their error constructor', async () => {
  const directory = resolve(import.meta.dir, '..')
  const build = Bun.spawnSync({ cmd: [process.execPath, 'build.ts'], cwd: directory, stdout: 'pipe', stderr: 'pipe' })
  expect(build.exitCode, new TextDecoder().decode(build.stderr)).toBe(0)
  const probe = Bun.spawnSync([process.execPath, '--tsconfig-override=' + resolve(directory, '../tsconfig.build.json'), '-e', `
    const root = await import('./dist/index.js')
    const input = await import('./dist/input.js')
    if (root.InputValidationError !== input.InputValidationError || root.parsePositiveId !== input.parsePositiveId) throw new Error('Published bindings differ')
    try { input.parsePositiveId(false); throw new Error('Invalid ID passed') } catch (error) { if (!(error instanceof root.InputValidationError)) throw error }
  `], {cwd:directory,stdout:'pipe',stderr:'pipe'})
  expect(probe.exitCode, probe.stderr.toString()).toBe(0)
  expect(await Bun.file(resolve(directory, 'dist/input.d.ts')).exists()).toBe(true)
})
