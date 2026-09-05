/**
 * Every name AGENTS.md calls a browser auto-import really is one.
 *
 * AGENTS.md is the first thing an agent reads in this repo, and its list of
 * auto-imported names was 13 wrong out of 24: `ref`, `computed`, `reactive`,
 * `watch`, `watchEffect`, `useColorMode`, `useLocalStorage`, `useCounter`,
 * `useIntersectionObserver`, `useScroll`, `useMouse`, `useParallax` and
 * `usePreferredReducedMotion` are in neither manifest. An agent writing
 * `ref(0)` in a template on that authority produces code that does not run.
 *
 * The file already carries a scar from this exact failure - it notes that the
 * count said "200+ composables" for a long time, "which was not a stale count
 * but a wrong one". The count was then fixed and the NAMES were not, which is
 * why this checks names rather than counting anything.
 *
 * `storage/framework/browser-auto-imports.json` is the authority, as AGENTS.md
 * itself says.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname

/** The section that lists what a template gets for free. */
function autoImportSection(): string {
  const doc = readFileSync(join(root, 'AGENTS.md'), 'utf-8')
  const start = doc.indexOf('The 27 `use*` composables')
  const end = doc.indexOf('Browser auto-imports are injected')

  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)

  return doc.slice(start, end)
}

/**
 * Only the bullets that CLAIM a name is auto-imported.
 *
 * Split by position rather than by an exclusion list. The first version
 * excluded the not-auto-imported names by name, which made it blind to exactly
 * those: adding `useScroll` back to the positive list passed, because
 * `useScroll` was on the exclusion list. Everything before the `**NOT**` bullet
 * is a claim; everything after it is the correction.
 */
function claimedAutoImports(): string[] {
  const section = autoImportSection()
  const correction = section.indexOf('**NOT**')

  expect(correction).toBeGreaterThan(-1)

  return [...section.slice(0, correction).matchAll(/`([A-Za-z_][\w]*)`/g)].map(match => match[1]!)
}

describe('AGENTS.md browser auto-imports', () => {
  it('names only globals the manifest actually provides', () => {
    // `globals` is a map of name -> true, not an array.
    const globals = Object.keys(JSON.parse(
      readFileSync(join(root, 'storage/framework/browser-auto-imports.json'), 'utf-8'),
    ).globals as Record<string, boolean>)

    const claimed = claimedAutoImports()
    expect(claimed.length).toBeGreaterThan(20)

    const notProvided = [...new Set(claimed)].filter(name => !globals.includes(name))
    expect(notProvided.sort()).toEqual([])
  })

  it('still warns off the names that are not auto-imported', () => {
    // The correction is the load-bearing part: `ref` is the one an agent
    // reaches for by habit.
    const section = autoImportSection()

    for (const name of ['ref', 'computed', 'reactive', 'watch'])
      expect(section).toContain(`\`${name}\``)
  })
})
