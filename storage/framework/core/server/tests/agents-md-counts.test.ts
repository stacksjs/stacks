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

/** A skill's text, by directory name. */
function skill(name: string): string {
  return readFileSync(path.frameworkPath(`defaults/ai/skills/${name}/SKILL.md`), 'utf-8')
}

/** The single number a claim states, in an arbitrary document. */
function claimedIn(source: string, where: string, pattern: RegExp): number {
  const match = source.match(pattern)
  if (!match)
    throw new Error(`${where} no longer contains the claim ${pattern} - update this test alongside the wording.`)

  return Number(match[1])
}

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

})

/**
 * The same claims live in the skills, and drifted the same way - `stacks-buddy`
 * said 50+ commands, `stacks-dashboard` said 250+ components while `AGENTS.md`
 * said 150+ for the same thing. Two documents disagreeing about one number is
 * how you can tell nothing was checking either (stacksjs/stacks#2056).
 */
describe('skill counts match the tree', () => {
  const modelCount = countFiles(path.frameworkPath('defaults/app/Models'), '.ts')
  const commerceModels = countFiles(path.frameworkPath('defaults/app/Models/commerce'), '.ts')

  it('stacks-orm and stacks-auto-imports agree on the model count', () => {
    expect(claimedIn(skill('stacks-orm'), 'stacks-orm', /(\d+) models/)).toBe(modelCount)
    expect(claimedIn(skill('stacks-auto-imports'), 'stacks-auto-imports', /\((\d+) models\)/)).toBe(modelCount)
  })

  it('stacks-commerce and stacks-types agree on the commerce model count', () => {
    expect(claimedIn(skill('stacks-commerce'), 'stacks-commerce', /and (\d+) models/)).toBe(commerceModels)
    expect(claimedIn(skill('stacks-types'), 'stacks-types', /Commerce \((\d+) models\)/)).toBe(commerceModels)
  })

  it('stacks-dashboard agrees with AGENTS.md on the component count', () => {
    const components = countFiles(path.frameworkPath('defaults/resources/components'), '.stx')

    expect(claimedIn(skill('stacks-dashboard'), 'stacks-dashboard', /(\d+) components/)).toBe(components)
    expect(claimed(/widgets \((\d+) components\)/)).toBe(components)
  })


  it('stacks-composables states how many composables the package exports', () => {
    const index = readFileSync(path.frameworkPath('core/composables/src/index.ts'), 'utf-8')
    const exported = new Set(index.match(/\buse[A-Z][A-Za-z0-9]*/g) ?? []).size

    expect(claimedIn(skill('stacks-composables'), 'stacks-composables', /(\d+) composables/)).toBe(exported)
  })

  it('stacks-writing-for-agents states how many skills ship', () => {
    const skills = readdirSync(path.frameworkPath('defaults/ai/skills'))
      .filter(entry => statSync(path.frameworkPath(`defaults/ai/skills/${entry}`)).isDirectory())

    expect(claimedIn(skill('stacks-writing-for-agents'), 'stacks-writing-for-agents', /ships (\d+) skills/)).toBe(skills.length)
  })
})
