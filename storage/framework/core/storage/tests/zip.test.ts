import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzip, zip } from '../src/zip'

/**
 * `zip` / `unzip` round-trip against the real binaries.
 *
 * These functions were broken for every input they were given, for their whole
 * life, and nothing noticed because nothing called them until `storage:backup`
 * (stacksjs/stacks#269). They built a shell command and single-quoted each
 * path; `runCommand` spawns WITHOUT a shell, so the quotes arrived as literal
 * characters and `zip` looked for a file named `'uploads'`, quotes included -
 * answering `zip error: Nothing to do!` on a directory that was not empty.
 *
 * Hence a round-trip rather than an assertion about the command string: the
 * bug was invisible to anything that only inspected what was built.
 */

const root = mkdtempSync(join(tmpdir(), 'stacks-zip-'))

afterAll(() => {
  rmSync(root, { force: true, recursive: true })
})

function fixture(name: string): string {
  const dir = join(root, name)
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src', 'a.txt'), 'hello')
  writeFileSync(join(dir, 'src', 'b.txt'), 'world')
  return dir
}

describe('zip / unzip', () => {
  it('round-trips a directory', async () => {
    const dir = fixture('basic')
    const archive = join(dir, 'out.zip')

    expect((await zip(['src'], archive, { cwd: dir })).isErr).toBeFalse()
    expect(existsSync(archive)).toBeTrue()

    const restored = join(dir, 'restored')
    mkdirSync(restored, { recursive: true })
    expect((await unzip([archive], { cwd: restored })).isErr).toBeFalse()

    expect(await Bun.file(join(restored, 'src', 'a.txt')).text()).toBe('hello')
    expect(await Bun.file(join(restored, 'src', 'b.txt')).text()).toBe('world')
  })

  it('handles a path with a space, which the string form never could', async () => {
    const dir = fixture('spaced')
    mkdirSync(join(dir, 'my uploads'), { recursive: true })
    writeFileSync(join(dir, 'my uploads', 'c.txt'), 'spaced')
    const archive = join(dir, 'out.zip')

    expect((await zip(['my uploads'], archive, { cwd: dir })).isErr).toBeFalse()

    const restored = join(dir, 'restored')
    mkdirSync(restored, { recursive: true })
    await unzip([archive], { cwd: restored })

    expect(await Bun.file(join(restored, 'my uploads', 'c.txt')).text()).toBe('spaced')
  })

  it('honours cwd, so the archive holds relative paths', async () => {
    // An archive carrying one machine's directory layout cannot be restored
    // onto another, which is the whole reason `cwd` is passed.
    const dir = fixture('relative')
    const archive = join(dir, 'out.zip')
    await zip(['src'], archive, { cwd: dir })

    // The ENTRY lines only: `unzip -l` prints the archive's own path in its
    // header, which is not what is stored inside it.
    const entries = Bun.spawnSync(['unzip', '-Z1', archive]).stdout.toString().trim().split('\n')

    expect(entries).toContain('src/a.txt')
    for (const entry of entries) {
      expect(entry.startsWith('/')).toBeFalse()
      expect(entry).not.toContain('stacks-zip-')
    }
  })

  it('reports a failure rather than pretending', async () => {
    const dir = fixture('missing')
    const result = await zip(['does-not-exist'], join(dir, 'out.zip'), { cwd: dir })
    expect(result.isErr).toBeTrue()
  })
})
