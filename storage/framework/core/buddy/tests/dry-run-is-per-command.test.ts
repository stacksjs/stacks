import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cli } from '@stacksjs/cli'
import { registerGlobalOptions } from '../src/global-options'

/**
 * `--dry-run` belongs to the commands that implement it, not to Buddy.
 *
 * Registered process-wide, it printed "Preview actions without making changes"
 * in all 346 commands' help while 30 read it. The other 316 accepted the flag
 * and ran live: setup migrated the database (stacksjs/stacks#853), stripe:setup
 * wrote real billing objects (stacksjs/stacks#2359), and mail:provision
 * restarted a shared production mail server, generated DKIM keys and called
 * ACME (stacksjs/stacks#2865) - all under a flag whose stated contract is to
 * change nothing.
 *
 * Declared per command, clapp's unknown-option path refuses it with exit 2
 * wherever it is not implemented, which is the outcome an operator who reaches
 * for the flag actually wants.
 */

const dir = join(import.meta.dir, '..', 'src', 'commands')

function sources(): string[] {
  const files: string[] = []
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory())
        walk(p)
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
        files.push(p)
    }
  }
  walk(dir)
  return files
}

/** Prose about the flag is not a use of the flag (stacksjs/stacks#2560). */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

/** A command that expects `options.dryRun` to arrive, by any spelling. */
const READS = [
  /\boptions\s*\??\.dryRun\b/,
  /\)\s*\.dryRun\b/,
  /\bdryRun\?\s*:\s*boolean/,
  /\bisDryRun\s*\(/,
  /\bisMigratePreview\s*\(/,
]

function undeclared(source: string, file: string): string[] {
  const found: string[] = []
  const clean = withoutComments(source)
  const starts = [...clean.matchAll(/\.command\(\s*[`'"]([^`'"]+)[`'"]/g)]

  for (const [index, match] of starts.entries()) {
    const from = match.index!
    const to = index + 1 < starts.length ? starts[index + 1].index! : clean.length
    const span = clean.slice(from, to)
    const name = match[1].split(' ')[0]

    const actionAt = span.indexOf('.action(')
    if (actionAt === -1)
      continue

    const declares = /\.option\(\s*[`'"][^`'"]*--dry-run/.test(span.slice(0, actionAt))
    const reads = READS.some(pattern => pattern.test(span.slice(actionAt)))

    if (reads && !declares)
      found.push(`${file}  ${name} reads options.dryRun and never declares --dry-run`)
  }
  return found
}

describe('--dry-run', () => {
  it('is not a process-wide flag', () => {
    const buddy = cli('buddy')
    registerGlobalOptions(buddy)

    const global = (buddy as unknown as { globalCommand: { options: Array<{ names: string[] }> } }).globalCommand
    const names = global.options.flatMap(option => option.names)

    expect(names).not.toContain('dryRun')
    expect(names).not.toContain('dry-run')
    // What is still global is what every command can honour; `--force` left
    // for the same reason (stacksjs/stacks#2869).
    expect(names).toContain('quiet')
  })

  it('is declared by every command that reads it', () => {
    const files = sources()
    expect(files.length).toBeGreaterThan(50)

    const missing = files.flatMap(file => undeclared(readFileSync(file, 'utf8'), file.slice(dir.length + 1)))

    expect(missing.sort()).toEqual([])
  })
})
