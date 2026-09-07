import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A flag that `--help` advertises must reach the code that runs.
 *
 * `build:components` and `build:web-components` called their build action
 * without passing `options` at all, while every sibling passed it - so
 * `buddy build:components --project foo` built with defaults and said nothing.
 * `cloud:remove --force` promised "force deletion of stack in bad state" and was
 * read by nothing, which is worse than absent: an operator with a stuck stack
 * passes it, gets the identical failure, and concludes the stack is unfixable
 * rather than that the flag is fiction.
 *
 * A command that hands its whole `options` object to something else is fine -
 * that callee reads the rest - so the check is only for flags nobody could
 * possibly see.
 */

const dir = join(import.meta.dir, '..', 'src', 'commands')

/** Handled by the CLI framework itself rather than by any one command. */
const framework = new Set(['verbose', 'quiet', 'debug', 'help', 'version', 'noInteraction', 'env', 'dryRun', 'project'])

const camel = (flag: string) => flag.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

function sources(): string[] {
  const files: string[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(p)
    }
  }
  walk(dir)
  return files
}

function unreadFlags(source: string, file: string): string[] {
  const found: string[] = []
  const starts = [...source.matchAll(/\.command\(\s*'([^']+)'/g)]

  for (const [index, match] of starts.entries()) {
    const from = match.index!
    const to = index + 1 < starts.length ? starts[index + 1].index! : source.length
    // A commented-out option is not a declared option.
    const block = source.slice(from, to).split('\n').filter(line => !/^\s*(\/\/|\*)/.test(line)).join('\n')
    const name = match[1].split(' ')[0]

    const actionAt = block.indexOf('.action(')
    if (actionAt === -1)
      continue
    const body = block.slice(actionAt)

    // `.action(someFunction)` hands the options straight to that function.
    if (/\.action\(\s*\w+\s*\)/.test(body))
      continue

    // Strip every `options.<field>` read and the debug trace that echoes the
    // whole object; if the identifier still appears, it is being passed on.
    const remaining = body
      .replace(/log\.\w+\([^)]*\boptions\b[^)]*\)/g, '')
      .replace(/\boptions\s*\??\.\w+/g, '')
      .replace(/\(options:[^)]*\)/, '')
    if (/\boptions\b/.test(remaining))
      continue

    for (const option of block.slice(0, actionAt).matchAll(/\.option\(\s*'([^']+)'/g)) {
      const long = option[1].split(',').map(f => f.trim()).find(f => f.startsWith('--'))
      if (!long)
        continue
      const key = camel(long.replace(/^--(no-)?/, '').split(/[ <[]/)[0])
      if (framework.has(key))
        continue
      const read = new RegExp(`\\boptions\\??\\.${key}\\b|\\b${key}\\b\\s*[,}:=]|\\{[^}]*\\b${key}\\b[^}]*\\}\\s*=`).test(body)
      if (!read)
        found.push(`${file}  ${name} declares --${long.replace(/^--/, '')} and never reads it`)
    }
  }
  return found
}

describe('declared flags', () => {
  it('are read by the command that declares them', () => {
    const files = sources()
    expect(files.length).toBeGreaterThan(50)

    const unread = files.flatMap(file => unreadFlags(readFileSync(file, 'utf8'), file.slice(dir.length + 1)))

    expect(unread.sort()).toEqual([])
  })
})
