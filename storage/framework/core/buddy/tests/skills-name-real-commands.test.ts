/**
 * Skills only name `buddy` commands that exist.
 *
 * The 115 skills under `storage/framework/defaults/ai/skills/` are what an
 * agent reads as authoritative before touching a subsystem, so a command named
 * there is one it will run. Three did not exist:
 *
 *   `buddy repl`                  the command is `tinker`
 *   `buddy generate:model-files`  no such command; the dev server does it
 *   `buddy generate:api-types`    the command is `generate:types`
 *
 * The generated command reference is the authority, kept current against the
 * runtime registry by `docs:buddy:check`.
 *
 * Scoped to skills on purpose. The same scan over `docs/` reports 26 hits and
 * essentially all are fine - bootcamp pages where the reader creates the
 * command being demonstrated, a roadmap TODO describing commands that are not
 * built yet, and bare prefixes like `buddy make:`. A check at that signal to
 * noise gets switched off, which is worse than not having it.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname
const skillsDir = join(root, 'storage/framework/defaults/ai/skills')

function markdownFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      markdownFiles(full, found)
    else if (entry.endsWith('.md'))
      found.push(full)
  }

  return found
}

describe('agent skills', () => {
  it('name only commands the CLI registers', () => {
    const reference = readFileSync(join(root, 'docs/guide/buddy/commands.md'), 'utf-8')
    const registered = new Set([...reference.matchAll(/`([a-z][a-z0-9:_-]*)`/g)].map(match => match[1]!))

    // `help` comes from the CLI framework rather than a `.command()` call.
    registered.add('help')

    const unknown: string[] = []
    for (const file of markdownFiles(skillsDir)) {
      readFileSync(file, 'utf-8').split('\n').forEach((line, index) => {
        for (const match of line.matchAll(/`(?:\.\/)?buddy ([a-z][a-z0-9:_-]*[a-z0-9])`/g)) {
          if (!registered.has(match[1]!))
            unknown.push(`${file.replace(root, '')}:${index + 1} buddy ${match[1]}`)
        }
      })
    }

    expect(unknown.sort()).toEqual([])
  })
})
