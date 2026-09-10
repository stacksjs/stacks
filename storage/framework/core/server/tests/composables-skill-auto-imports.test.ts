/**
 * Every name `stacks-composables` says is free really is free.
 *
 * The skill said "All are auto-imported in STX templates" while naming 88
 * composables, 68 of which are not. `useCounter`, `useLocalStorage`,
 * `useMouse`, `useScroll`, `useIntersectionObserver` and
 * `usePreferredReducedMotion` were all on that page presented as free, and are
 * exactly the names `AGENTS.md` was corrected for listing the same way.
 *
 * `docs:agent-counts` now pins how MANY are auto-imported, which is the check
 * that would have caught the headline. It cannot catch a wrong name: a page can
 * say 27 and then name the wrong 27. This is the names half, and it mirrors
 * `agents-md-auto-imports.test.ts`, which exists for the same reason one file
 * over.
 *
 * `storage/framework/browser-auto-imports.json` is the authority, as both
 * documents say.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const root = new URL('../../../../../', import.meta.url).pathname
const skill = readFileSync(
  join(root, 'storage/framework/defaults/ai/skills/stacks-composables/SKILL.md'),
  'utf-8',
)

function manifestGlobals(): Set<string> {
  return new Set(Object.keys(JSON.parse(
    readFileSync(join(root, 'storage/framework/browser-auto-imports.json'), 'utf-8'),
  ).globals as Record<string, boolean>))
}

/**
 * The list is delimited by comment markers in the document itself.
 *
 * Two earlier versions of this bound to the prose around it and both broke on
 * an edit that changed nothing about the list: one anchored on `useAbs`, so
 * deleting that name moved the anchor rather than failing, and every name read
 * as missing at once; the next anchored on a sentence that got reworded. The
 * markers say what they are for, so an editor can see why they are there.
 */
const BEGIN = '<!-- auto-imported:begin'
const END = '<!-- auto-imported:end -->'

function claimedFree(): string[] {
  const begin = skill.indexOf(BEGIN)
  const finish = skill.indexOf(END)

  expect(begin).toBeGreaterThan(-1)
  expect(finish).toBeGreaterThan(begin)

  const list = skill.slice(begin + BEGIN.length, finish)

  return [...list.matchAll(/`(use[A-Z][A-Za-z0-9]*)`/g)].map(match => match[1]!)
}

describe('the composables skill', () => {
  it('lists only composables the manifest actually provides', () => {
    const globals = manifestGlobals()

    expect(claimedFree().filter(name => !globals.has(name))).toEqual([])
  })

  it('lists every use* the manifest provides, so none reads as needing an import', () => {
    const claimed = new Set(claimedFree())
    const free = [...manifestGlobals()].filter(name => /^use[A-Z]/.test(name))

    expect(free.filter(name => !claimed.has(name))).toEqual([])
  })

})
