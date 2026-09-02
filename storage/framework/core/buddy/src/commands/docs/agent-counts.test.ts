/**
 * The counts checker, alongside `links.test.ts`.
 *
 * The value here is not that the numbers are right today - `--check` in CI
 * says that. It is that the checker still FINDS them: every claim is located
 * by a regex over prose, so a reworded sentence silently stops being checked,
 * and a check that quietly matches nothing is worse than no check at all.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../../../../../', import.meta.url).pathname
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
