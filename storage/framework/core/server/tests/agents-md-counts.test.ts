/**
 * The counts in `AGENTS.md` describe the framework as it is.
 *
 * Every agent working in this repo reads that file, so a wrong number there is
 * not cosmetic - it is a false statement acted on. The composables line said
 * "200+ composables" available with no import when the browser manifest
 * declares 83 names, which is not a stale count but a wrong one, and an agent
 * trusting it reaches for a global that does not exist. Others had drifted far
 * enough to mislead in the other direction: "50+ commands" against 315,
 * "96+ migrations" against 220 (stacksjs/stacks#2056).
 *
 * `N+` phrasing hides this: it stays technically true while the real number
 * grows past any use, so nothing ever forces a correction. These are pinned to
 * exact numbers instead, and this test is what makes the pin mean something.
 *
 * When one fails, the fix is to update `AGENTS.md` - the number here is
 * measured from the tree, so the tree is right and the sentence is stale.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { path } from '@stacksjs/path'

const AGENTS = readFileSync(path.projectPath('AGENTS.md'), 'utf-8')

/** The single number a claim states, so the assertion names both sides. */
function claimed(pattern: RegExp): number {
  const match = AGENTS.match(pattern)
  if (!match)
    throw new Error(`AGENTS.md no longer contains the claim ${pattern} - update this test alongside the wording.`)

  return Number(match[1])
}

function countFiles(dir: string, extension: string, recursive = true): number {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  }
  catch {
    return 0
  }

  return entries.reduce((total, entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      return recursive ? total + countFiles(full, extension) : total
    if (!entry.endsWith(extension) || entry === 'index.ts')
      return total
    return total + 1
  }, 0)
}

describe('AGENTS.md counts match the tree', () => {
  it('states the number of built-in models', () => {
    expect(claimed(/(\d+) built-in models you can use or override/))
      .toBe(countFiles(path.frameworkPath('defaults/app/Models'), '.ts'))
  })

  it('states the number of auto-imported models', () => {
    expect(claimed(/All (\d+) models \(`User`/))
      .toBe(countFiles(path.frameworkPath('defaults/app/Models'), '.ts'))
  })

  it('states the number of default actions', () => {
    expect(claimed(/(\d+) default actions/))
      // The barrel, not the file count: it is what an app can actually resolve
      // by name, and a file the generator skipped is not an action you have.
      .toBe(readFileSync(path.frameworkPath('auto-imports/actions.ts'), 'utf-8')
        .split('\n')
        .filter(line => /^\s+'/.test(line))
        .length)
  })

  it('states the number of components', () => {
    expect(claimed(/widgets \((\d+) components\)/))
      .toBe(countFiles(path.frameworkPath('defaults/resources/components'), '.stx'))
  })

  it('states the number of migrations', () => {
    expect(claimed(/(\d+) migrations ship for/))
      .toBe(countFiles(path.projectPath('database/migrations'), '.sql'))
  })

  it('states the number of browser auto-imports', () => {
    const manifest = JSON.parse(readFileSync(path.frameworkPath('browser-auto-imports.json'), 'utf-8'))

    expect(claimed(/There are \*\*(\d+)\*\* of/)).toBe(Object.keys(manifest.globals).length)
  })

  it('states the number of buddy commands, agreeing with the generated reference', () => {
    // `docs:buddy` writes that number from the runtime registry and CI rejects
    // it when stale, so the reference is the authority and AGENTS.md follows it.
    const reference = readFileSync(path.projectPath('docs/guide/buddy/commands.md'), 'utf-8')
    const generated = Number(reference.match(/\*\*(\d+) commands\*\*/)![1])

    expect(claimed(/CLI \((\d+) commands/)).toBe(generated)
  })
})
