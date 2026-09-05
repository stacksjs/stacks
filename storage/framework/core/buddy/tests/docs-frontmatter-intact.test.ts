/**
 * No page description is missing the code that was in it.
 *
 * Descriptions are generated from each page's first paragraph, and inline code
 * spans were DROPPED rather than unwrapped. The sentences survived; the nouns
 * did not:
 *
 *   "is the low-level database query interface. It re-exports ; most ..."
 *   "This guide covers managing Bun's lockfile () in your Stacks ..."
 *
 * The first lost `@stacksjs/query-builder` and `bun-query-builder` - so it
 * begins with "is" and re-exports nothing. The second lost `bun.lock`, leaving
 * empty parentheses. `docs/basics/routing.md` went further and had two lines of
 * TypeScript in its description, complete with a literal `\n`.
 *
 * Only signatures that cannot occur in real prose are checked. "Starts with a
 * lowercase verb" looked promising and matched 61 perfectly good descriptions
 * ("The Coupons module in the Commerce package ..."), and bare `()` matches a
 * legitimate `validateSkill()`. What is left: a literal `\n`, a space before a
 * semicolon, and a space before empty parentheses.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname

function markdownFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.'))
      continue

    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      markdownFiles(full, found)
    else if (entry.endsWith('.md'))
      found.push(full)
  }

  return found
}

/** A page's `description:`, or null when it has no frontmatter. */
function description(file: string): string | null {
  const lines = readFileSync(file, 'utf-8').split('\n')
  if (lines[0]?.trim() !== '---')
    return null

  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
  if (close < 0)
    return null

  return lines.slice(1, close).find(line => line.startsWith('description:'))?.slice('description:'.length).trim() ?? null
}

describe('documentation frontmatter', () => {
  it('has no description with its code spans eaten', () => {
    const damaged: string[] = []

    for (const file of markdownFiles(join(root, 'docs'))) {
      const text = description(file)
      if (!text)
        continue

      // A literal backslash-n means a multi-line snippet was flattened in.
      // ` ;` and ` ()` are what is left where a code span used to be.
      if (/\\n/.test(text) || /\s;/.test(text) || /\s\(\s*\)/.test(text))
        damaged.push(`${file.replace(root, '')}: ${text.slice(0, 60)}`)
    }

    expect(damaged.sort()).toEqual([])
  })
})
