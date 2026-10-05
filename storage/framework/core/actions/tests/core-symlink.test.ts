import { afterEach, beforeEach, expect, it } from 'bun:test'
import { lstatSync, mkdirSync, mkdtempSync, readlinkSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * `generateCoreSymlink()` ran `rm -f <link>` and `ln -s <target> <link>`
 * through runCommand, which splits a string on whitespace without a shell, so
 * in a project whose path has a space the link pointed at the wrong place.
 */
let project: string

beforeEach(() => {
  project = join(realpathSync(mkdtempSync(join(tmpdir(), 'stacks core symlink '))), 'my app')
  mkdirSync(join(project, 'storage/framework'), { recursive: true })
})

afterEach(() => {
  rmSync(join(project, '..'), { recursive: true, force: true })
})

function generate(): void {
  const result = Bun.spawnSync([process.execPath, '-e', `
    const { generateCoreSymlink } = await import(${JSON.stringify(new URL('../src/generate/index.ts', import.meta.url).href)})
    await generateCoreSymlink()
    process.exit(0)
  `], { cwd: project, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0)
    throw new Error(result.stderr.toString())
}

it('links .framework to storage/framework in a path with spaces', () => {
  generate()

  const link = join(project, '.framework')
  expect(lstatSync(link).isSymbolicLink()).toBe(true)
  expect(readlinkSync(link)).toBe(join(project, 'storage/framework'))
}, 60_000)

it('replaces a stale link rather than failing on it', () => {
  symlinkSync(join(project, 'nowhere'), join(project, '.framework'))

  generate()

  expect(readlinkSync(join(project, '.framework'))).toBe(join(project, 'storage/framework'))
}, 60_000)
