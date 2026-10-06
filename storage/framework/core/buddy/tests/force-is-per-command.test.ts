import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cli } from '@stacksjs/cli'
import { registerGlobalOptions } from '../src/global-options'

/**
 * `--force` belongs to the commands that implement it, as `--dry-run` does
 * (stacksjs/stacks#2869, following #2865).
 *
 * Registered process-wide, every command's help offered "Skip confirmation
 * prompts" while the commands that skip a confirmation read `--yes`.
 * `buddy gdpr:erase --force` was accepted, ignored, and then refused in a
 * non-interactive shell with "re-run with --yes" - the help promised the same
 * thing twice and only one of the two flags was wired up.
 *
 * Declared per command, clapp refuses `--force` with exit 2 wherever it is not
 * implemented.
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

/** Prose about the flag is not a use of the flag. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

/** A command action that expects `options.force` to arrive. */
const READS = [/\boptions\s*\??\.force\b/, /\{\s*[^}]*\bforce\b[^}]*\}\s*=\s*options\b/]

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

    const declares = /\.option\(\s*[`'"][^`'"]*--force\b/.test(span.slice(0, actionAt))
    const reads = READS.some(pattern => pattern.test(span.slice(actionAt)))

    if (reads && !declares)
      found.push(`${file}  ${name} reads options.force and never declares --force`)
  }
  return found
}

describe('--force', () => {
  it('is not a process-wide flag', () => {
    const buddy = cli('buddy')
    registerGlobalOptions(buddy)

    const global = (buddy as unknown as { globalCommand: { options: Array<{ names: string[] }> } }).globalCommand
    const names = global.options.flatMap(option => option.names)

    expect(names).not.toContain('force')
    // What is still global is what every command can honour.
    expect(names).toContain('quiet')
    expect(names).toContain('verbose')
  })

  it('leaves the commands that confirm one flag to skip it, the same everywhere: --yes', () => {
    // The commands #2869 found asking for confirmation while the global
    // --force sat in their help unread. Two had no way to skip at all, and
    // domains:purchase registered (and billed) the domain before its only
    // prompt. deploy:rollback was on that list too, but it never asks: it
    // runs unattended after a failed deploy, so it has nothing to skip.
    const confirming = ['domains:purchase', 'domains:remove', 'gdpr:erase', 'cloud:remove', 'cloud', 'cloud:invalidate-cache', 'server:flash']
    const spans = new Map<string, string>()
    for (const file of sources()) {
      const clean = withoutComments(readFileSync(file, 'utf8'))
      const starts = [...clean.matchAll(/\.command\(\s*[`'"]([^`'"]+)[`'"]/g)]
      for (const [index, match] of starts.entries()) {
        const to = index + 1 < starts.length ? starts[index + 1].index! : clean.length
        spans.set(match[1].split(' ')[0]!, clean.slice(match.index!, to))
      }
    }

    for (const name of confirming) {
      const span = spans.get(name)
      expect(span, `${name} is registered`).toBeDefined()
      const head = span!.slice(0, span!.indexOf('.action('))
      // One spelling, short form included, so `-y` works wherever a prompt is.
      expect(/\.option\(\s*[`'"]-y, --yes[`'"]/.test(head), `${name} declares -y, --yes`).toBe(true)
      expect(/\.option\(\s*[`'"][^`'"]*--force\b/.test(head), `${name} does not also offer --force`).toBe(false)
    }
  })

  it('is declared by every command that reads it', () => {
    const files = sources()
    expect(files.length).toBeGreaterThan(50)

    const missing = files.flatMap(file => undeclared(readFileSync(file, 'utf8'), file.slice(dir.length + 1)))

    expect(missing.sort()).toEqual([])
  })
})
