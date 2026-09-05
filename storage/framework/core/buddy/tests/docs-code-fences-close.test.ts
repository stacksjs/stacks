/**
 * Every fenced code block in the docs is closed.
 *
 * Three pages under `docs/basics/` opened a block that never closed, so from
 * that point the rest of the page rendered as code - headings, prose and all.
 * The cause is the same in each: the opening fence went missing and the code
 * sat bare under the frontmatter, with a stray closer further down. In
 * `routing.md` the fence had been swallowed into the frontmatter itself, whose
 * `description` was two lines of TypeScript.
 *
 * Nothing caught it. `docs:links:check` reads links, and the count checks read
 * counts; an unclosed fence is neither.
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

describe('documentation code fences', () => {
  it('are all closed', () => {
    const unclosed = markdownFiles(join(root, 'docs')).filter((file) => {
      let open = false
      for (const line of readFileSync(file, 'utf-8').split('\n')) {
        // Only a fence at the start of a line delimits a block; an indented
        // one inside a block is content.
        if (line.startsWith('```'))
          open = !open
      }
      return open
    })

    expect(unclosed.map(file => file.replace(root, '')).sort()).toEqual([])
  })

  it('never leave code bare under the frontmatter', () => {
    // How all three broke: the opener vanished and the snippet became prose.
    const bare = markdownFiles(join(root, 'docs')).filter((file) => {
      const lines = readFileSync(file, 'utf-8').split('\n')
      if (lines[0]?.trim() !== '---')
        return false

      const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---')
      if (close < 0)
        return false

      const first = lines.slice(close + 1).find(line => line.trim())
      // A line ending in `{`, `(` or `;` right after the frontmatter is code
      // that lost its fence, not a sentence.
      return !!first && /[{(;]$/.test(first.trim()) && !first.startsWith('```')
    })

    expect(bare.map(file => file.replace(root, '')).sort()).toEqual([])
  })
})
