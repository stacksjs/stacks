import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { describeDrift, findGeneratedDrift, REGENERATE } from './check-declarations-fresh'

let root = ''

/** A throwaway repository with two committed "generated" files and one ignored path. */
function repo(): string {
  root = mkdtempSync(join(tmpdir(), 'declarations-fresh-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
  git('init', '-q')
  mkdirSync(join(root, 'database'))
  mkdirSync(join(root, 'types'))
  writeFileSync(join(root, 'database/types.d.ts'), 'archived: number\n')
  writeFileSync(join(root, 'types/server.d.ts'), 'declare const User: any\n')
  writeFileSync(join(root, '.gitignore'), 'cache/\n')
  git('add', '.')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init')
  return root
}

const read = (path: string) => readFileSync(join(root, path), 'utf8')

afterEach(() => {
  if (root)
    rmSync(root, { recursive: true, force: true })
})

describe('findGeneratedDrift', () => {
  it('is empty when generation reproduces the tree', async () => {
    repo()
    const drift = await findGeneratedDrift(root, async () => {
      writeFileSync(join(root, 'database/types.d.ts'), 'archived: number\n')
    })
    expect(drift).toEqual([])
  })

  // The bug in stacksjs/stacks#2879: the check read one file and the generator
  // wrote several, so a stale `database/types.d.ts` passed.
  it('reports a file it was never told about', async () => {
    repo()
    const drift = await findGeneratedDrift(root, async () => {
      writeFileSync(join(root, 'database/types.d.ts'), 'archived: boolean\n')
    })
    expect(drift).toEqual([{ path: 'database/types.d.ts', change: 'modified', removed: ['archived: number'], added: ['archived: boolean'] }])
  })

  it('reports files generation creates or removes', async () => {
    repo()
    const drift = await findGeneratedDrift(root, async () => {
      writeFileSync(join(root, 'types/new.d.ts'), 'declare const Post: any\n')
      rmSync(join(root, 'types/server.d.ts'))
    })
    expect(drift.map(one => [one.path, one.change])).toEqual([
      ['types/new.d.ts', 'created'],
      ['types/server.d.ts', 'deleted'],
    ])
  })

  // `storage/public` is a tracked symlink to a directory, and reading it as a
  // file threw EISDIR before a single artifact was compared.
  it('steps over a tracked symlink to a directory', async () => {
    repo()
    symlinkSync('types', join(root, 'public'))
    execFileSync('git', ['add', 'public'], { cwd: root })
    const drift = await findGeneratedDrift(root, async () => {
      writeFileSync(join(root, 'database/types.d.ts'), 'archived: boolean\n')
    })
    expect(drift.map(one => one.path)).toEqual(['database/types.d.ts'])
  })

  it('ignores what git ignores', async () => {
    repo()
    const drift = await findGeneratedDrift(root, async () => {
      mkdirSync(join(root, 'cache'))
      writeFileSync(join(root, 'cache/scan.json'), '{}')
    })
    expect(drift).toEqual([])
  })

  it('puts back the tree it found, local edits included', async () => {
    repo()
    // An uncommitted edit the developer has not regenerated yet.
    writeFileSync(join(root, 'types/server.d.ts'), 'declare const User: any // wip\n')

    await findGeneratedDrift(root, async () => {
      writeFileSync(join(root, 'database/types.d.ts'), 'archived: boolean\n')
      writeFileSync(join(root, 'types/server.d.ts'), 'regenerated\n')
      writeFileSync(join(root, 'types/new.d.ts'), 'new\n')
    })

    expect(read('database/types.d.ts')).toBe('archived: number\n')
    expect(read('types/server.d.ts')).toBe('declare const User: any // wip\n')
    expect(existsSync(join(root, 'types/new.d.ts'))).toBe(false)
  })

  it('puts the tree back when generation fails halfway', async () => {
    repo()
    const run = findGeneratedDrift(root, async () => {
      writeFileSync(join(root, 'database/types.d.ts'), 'half written')
      throw new Error('generator crashed')
    })
    await expect(run).rejects.toThrow('generator crashed')
    expect(read('database/types.d.ts')).toBe('archived: number\n')
  })
})

describe('the failure message', () => {
  it('names each file and how it changed', () => {
    const text = describeDrift([
      { path: 'database/types.d.ts', change: 'modified', removed: ['archived: number'], added: ['archived: boolean'] },
      { path: 'types/old.d.ts', change: 'deleted', removed: [], added: [] },
    ])
    expect(text).toContain('modified: database/types.d.ts')
    expect(text).toContain('- archived: number')
    expect(text).toContain('+ archived: boolean')
    expect(text).toContain('deleted: types/old.d.ts')
  })

  it('shows both sides of a long change', () => {
    const removed = Array.from({ length: 30 }, (_, i) => `old ${i}`)
    const added = Array.from({ length: 30 }, (_, i) => `new ${i}`)
    const text = describeDrift([{ path: 'a.ts', change: 'modified', removed, added }], 10)
    expect(text.split('\n').filter(line => line.includes('- old')).length).toBe(5)
    expect(text.split('\n').filter(line => line.includes('+ new')).length).toBe(5)
    expect(text).toContain('... and 50 more')
  })

  it('gives the whole budget to the side that needs it', () => {
    const removed = Array.from({ length: 30 }, (_, i) => `old ${i}`)
    const text = describeDrift([{ path: 'a.ts', change: 'modified', removed, added: ['new'] }], 10)
    expect(text.split('\n').filter(line => line.includes('- old')).length).toBe(9)
    expect(text).toContain('+ new')
  })

  it('caps a long diff per file', () => {
    const added = Array.from({ length: 30 }, (_, i) => `line ${i}`)
    const text = describeDrift([{ path: 'a.ts', change: 'created', removed: [], added }], 10)
    expect(text).toContain('... and 20 more')
  })

  // A developer whose shell sets DB_CONNECTION=postgres would otherwise
  // regenerate, commit, and fail this check again.
  it('tells you to regenerate canonically', () => {
    expect(REGENERATE).toContain('STACKS_CANONICAL_FEATURES=1')
  })
})
