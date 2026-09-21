/**
 * The counts checker, alongside `links.test.ts`.
 *
 * The value here is not that the numbers are right today - `--check` in CI
 * says that. It is that the checker still FINDS them: every claim is located
 * by a regex over prose, so a reworded sentence silently stops being checked,
 * and a check that quietly matches nothing is worse than no check at all.
 */
import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { countFiles } from '../src/commands/docs/agent-counts'

const root = new URL('../../../../../', import.meta.url).pathname
const source = readFileSync(join(root, 'storage/framework/core/buddy/src/commands/docs/agent-counts.ts'), 'utf-8')

/** Every `{ file, pattern }` site the tool declares. */
function sites(): Array<{ file: string, pattern: RegExp }> {
  return [...source.matchAll(/\{ file: (`[^`]+`|\w+), pattern: \/(.+?)\/ \}/g)].map(match => ({
    file: match[1]!
      .replace(/`/g, '')
      .replace('${SKILLS}', 'storage/framework/defaults/ai/skills')
      .replace(/^AGENTS$/, 'AGENTS.md'),
    pattern: new RegExp(match[2]!),
  }))
}

describe('agent-counts', () => {
  it('declares at least one site for every claim', () => {
    expect(sites().length).toBeGreaterThan(0)
  })

  it('every declared pattern still matches its document', () => {
    const missing = sites().filter(({ file, pattern }) => !pattern.test(readFileSync(join(root, file), 'utf-8')))

    // A pattern matching nothing means the sentence was reworded and this
    // claim is no longer checked - the exact failure mode a prose-matching
    // checker has, and the one nothing else would notice.
    expect(missing.map(entry => `${entry.file}: ${entry.pattern}`)).toEqual([])
  })

  it('covers the documents agents actually read', () => {
    const files = new Set(sites().map(entry => entry.file))

    expect(files.has('AGENTS.md')).toBe(true)
    expect([...files].some(file => file.includes('/skills/'))).toBe(true)
  })
})

describe('countFiles', () => {
  /*
   * The counter walks the working tree, so without a filter it counts files
   * git was told to ignore. `buddy migrate:regenerate` drops .sql into
   * database/migrations and a personal global `*.sql` rule keeps them
   * untracked forever, so one machine counted 230 migrations where a clean
   * checkout and CI count 229. `--check` failed there and `--write` would have
   * committed the 230 for CI to reject right back - and the release gate runs
   * these checks, so a local scratch file blocked releasing entirely.
   *
   * The fixture carries its own .gitignore rather than leaning on a rule that
   * happens to exist in this repo today: the property under test is "ignored
   * files are not counted", not "this repo ignores .sql". The extension is
   * deliberately neutral - a .sql fixture is itself swallowed by the global
   * rule that caused the bug, so the kept file would vanish too.
   *
   * Tracked files are counted even when a rule would otherwise match them,
   * because `git check-ignore` consults the index: that is what keeps the 229
   * committed .sql migrations counted on a machine whose global gitignore says
   * `*.sql`.
   */
  const fixture = 'storage/framework/core/buddy/src/commands/docs/.agent-counts-fixture'

  it('counts files git carries and skips the ones it ignores', () => {
    const dir = join(root, fixture)
    mkdirSync(dir, { recursive: true })
    try {
      writeFileSync(join(dir, '.gitignore'), 'generated-*.txt\n')
      writeFileSync(join(dir, 'kept.txt'), '-- tracked\n')
      writeFileSync(join(dir, 'generated-scratch.txt'), '-- ignored\n')

      expect(countFiles(fixture, '.txt')).toBe(1)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to the plain walk when git cannot answer', () => {
    // A vendored copy of the framework inside a consumer app is not a git
    // repository at all. Counting nothing there would be worse than counting
    // the disk, so the filter has to fail open.
    const dir = mkdtempSync(join(tmpdir(), 'agent-counts-'))
    try {
      writeFileSync(join(dir, 'a.txt'), '')
      writeFileSync(join(dir, 'b.txt'), '')

      expect(countFiles(relative(root, dir), '.txt')).toBe(2)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
