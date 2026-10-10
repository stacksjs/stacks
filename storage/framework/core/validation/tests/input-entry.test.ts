import { expect, test } from 'bun:test'
import { resolve } from 'node:path'

test('published root and narrow input entrypoints share their error constructor', async () => {
  const directory = resolve(import.meta.dir, '..')
  const build = Bun.spawnSync({ cmd: [process.execPath, 'build.ts'], cwd: directory, stdout: 'pipe', stderr: 'pipe' })
  expect(build.exitCode, new TextDecoder().decode(build.stderr)).toBe(0)
  const root = await import('../dist/index.js')
  const input = await import('../dist/input.js')
  expect(root.InputValidationError).toBe(input.InputValidationError)
  expect(root.parsePositiveId).toBe(input.parsePositiveId)
  expect(() => input.parsePositiveId(false)).toThrow(root.InputValidationError)
  expect(await Bun.file(resolve(directory, 'dist/input.d.ts')).exists()).toBe(true)
})
