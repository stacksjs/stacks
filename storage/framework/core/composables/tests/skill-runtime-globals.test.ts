/**
 * Every name `stacks-composables` says a template gets for free is a real
 * runtime global (stacksjs/stacks#2585).
 *
 * The first version of this test lived in `@stacksjs/server` and checked the
 * list against `storage/framework/browser-auto-imports.json`, because
 * `AGENTS.md` names that file the authority. It is not the authority for this
 * question. Nothing reads the manifest at build time - it feeds an ambient
 * `.d.ts`, so it decides what `tsc` accepts and not what the browser has - and
 * only five of the 27 `use*` it declares are in the runtime. The list it
 * validated was 22 names that typecheck and then throw.
 *
 * So this generates the runtime that actually gets served and reads the globals
 * off it. `getCachedSignalsRuntime` is what the dev server and the compile path
 * both go through, and a name resolves in a template if and only if that output
 * attaches it to `window`.
 *
 * Lives here rather than in `@stacksjs/server` because this package depends on
 * `@stacksjs/stx` and that one does not.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const root = new URL('../../../../../', import.meta.url).pathname
const skill = readFileSync(
  join(root, 'storage/framework/defaults/ai/skills/stacks-composables/SKILL.md'),
  'utf-8',
)

const BEGIN = '<!-- auto-imported:begin'
const END = '<!-- auto-imported:end -->'

/** The names the skill presents as free, delimited by markers in the document. */
function claimedFree(): string[] {
  const begin = skill.indexOf(BEGIN)
  const finish = skill.indexOf(END)

  expect(begin).toBeGreaterThan(-1)
  expect(finish).toBeGreaterThan(begin)

  return [...skill.slice(begin + BEGIN.length, finish).matchAll(/`(use[A-Z][A-Za-z0-9]*)`/g)]
    .map(match => match[1]!)
}

/**
 * The `use*` names the served runtime attaches to `window`.
 *
 * `window.<name> =` rather than every `use*` appearing in the source: 38 of
 * them are mentioned and 25 are attached, the rest being module-scoped helpers
 * a template cannot reach.
 */
async function runtimeGlobals(): Promise<Set<string>> {
  const stx = await import('@stacksjs/stx') as unknown as {
    getCachedSignalsRuntime: (debug: boolean) => Promise<string>
  }
  const source = await stx.getCachedSignalsRuntime(false)

  expect(source.length).toBeGreaterThan(1000)

  return new Set(
    [...new Set(source.match(/\buse[A-Z][A-Za-z0-9]*/g) ?? [])]
      .filter(name => new RegExp(`window\\.${name}\\s*=`).test(source)),
  )
}

describe('the composables skill', () => {
  it('lists only names the stx runtime attaches to window', async () => {
    const globals = await runtimeGlobals()

    expect(claimedFree().filter(name => !globals.has(name))).toEqual([])
  })

  it('lists every runtime global, so none reads as needing an import', async () => {
    const claimed = new Set(claimedFree())
    const globals = await runtimeGlobals()

    expect([...globals].filter(name => !claimed.has(name)).sort()).toEqual([])
  })
})
