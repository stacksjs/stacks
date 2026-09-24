/**
 * The preload survives an app with no `resources/functions`.
 *
 * `buddy new --minimal` leaves that folder empty and git does not keep empty
 * folders, so a fresh checkout has none - and `Glob.scan` throws ENOENT on a
 * missing `cwd`. The preload runs before every command, so CI's first
 * `buddy key:generate` died on it with no stack at all.
 */
import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { userFunctionFiles } from '../../../defaults/resources/plugins/user-functions'

async function collect(dir: string): Promise<string[]> {
  const files: string[] = []
  for await (const file of userFunctionFiles(dir))
    files.push(file)
  return files.sort()
}

describe('userFunctionFiles', () => {
  it('yields nothing for a folder that does not exist', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-fns-'))
    expect(await collect(join(root, 'resources/functions'))).toEqual([])
  })

  it('yields the .ts files, skipping declarations', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'stacks-fns-')), 'functions')
    mkdirSync(join(dir, 'nested'), { recursive: true })
    writeFileSync(join(dir, 'a.ts'), 'export const a = 1\n')
    writeFileSync(join(dir, 'nested/b.ts'), 'export const b = 2\n')
    writeFileSync(join(dir, 'types.d.ts'), 'export {}\n')
    expect((await collect(dir)).map(file => file.slice(dir.length + 1))).toEqual(['a.ts', 'nested/b.ts'])
  })
})
