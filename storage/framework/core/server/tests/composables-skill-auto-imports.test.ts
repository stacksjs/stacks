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
 * The names the skill presents as free.
 *
 * Bounded by position rather than filtered by an exclusion list. The
 * AGENTS.md version of this test learned that the hard way: excluding the
 * known-bad names by name made it blind to exactly those names coming back.
 *
 * The prose above the list names counter-examples (`useCounter` and friends,
 * as things that are NOT free), so that sentence is cut out first. It is
 * delimited by its own text rather than by the first name in the list - an
 * earlier version anchored on `useAbs`, so deleting `useAbs` moved the anchor
 * instead of failing, and every name read as missing at once.
 */
function claimedFree(): string[] {
  const start = skill.indexOf('## The 27 you can write bare in a template')
  const end = skill.indexOf('A name not on that list is imported')

  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)

  const section = skill.slice(start, end)
  const counterExamples = section.indexOf('second group -')
  const listBegins = section.indexOf('as free.')

  expect(counterExamples).toBeGreaterThan(-1)
  expect(listBegins).toBeGreaterThan(counterExamples)

  const list = section.slice(listBegins + 'as free.'.length)

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
