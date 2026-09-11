/**
 * Every name the docs say a template gets for free is a real runtime global
 * (stacksjs/stacks#2585).
 *
 * Covers two documents - `AGENTS.md` and the `stacks-composables` skill -
 * because they answer the same question and got the same answer wrong for the
 * same reason.
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

/**
 * The two documents, each with the markers delimiting its list and the shape of
 * name it lists. `AGENTS.md` covers every global; the skill covers composables
 * only, so it is checked against the `use*` subset.
 */
const documents = [
  {
    label: 'AGENTS.md',
    path: 'AGENTS.md',
    begin: '<!-- runtime-globals:begin',
    end: '<!-- runtime-globals:end -->',
    covers: () => true,
  },
  {
    label: 'the stacks-composables skill',
    path: 'storage/framework/defaults/ai/skills/stacks-composables/SKILL.md',
    begin: '<!-- auto-imported:begin',
    end: '<!-- auto-imported:end -->',
    covers: (name: string) => /^use[A-Z]/.test(name),
  },
]

/** The names a document presents as free, delimited by markers in it. */
function claimedFree(doc: typeof documents[number]): string[] {
  const source = readFileSync(join(root, doc.path), 'utf-8')
  const begin = source.indexOf(doc.begin)
  const finish = source.indexOf(doc.end)

  expect(begin).toBeGreaterThan(-1)
  expect(finish).toBeGreaterThan(begin)

  // Start after the opening comment closes, not after its marker: the comment
  // explains itself in prose and names `window`, which would otherwise read as
  // a claimed global.
  const listStart = source.indexOf('-->', begin) + '-->'.length

  return [...source.slice(listStart, finish)
    .matchAll(/`([A-Za-z_$][\w$]*)`/g)]
    .map(match => match[1]!)
    .filter(doc.covers)
}

/**
 * The names the served runtime attaches to `window`.
 *
 * Read from the assignments rather than from every identifier in the source:
 * plenty of `use*` are mentioned and only some are attached, the rest being
 * module-scoped helpers a template cannot reach. Internals (`__stx_*`, `$…`)
 * are not part of the documented surface.
 */
async function runtimeGlobals(): Promise<Set<string>> {
  const stx = await import('@stacksjs/stx') as unknown as {
    getCachedSignalsRuntime: (debug: boolean) => Promise<string>
  }
  const source = await stx.getCachedSignalsRuntime(false)

  expect(source.length).toBeGreaterThan(1000)

  return new Set(
    [...source.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)]
      .map(match => match[1]!)
      .filter(name => !name.startsWith('__') && !name.startsWith('$')),
  )
}

for (const doc of documents) {
  describe(doc.label, () => {
    it('lists only names the stx runtime attaches to window', async () => {
      const globals = await runtimeGlobals()

      expect(claimedFree(doc).filter(name => !globals.has(name))).toEqual([])
    })

    it('lists every runtime global it covers, so none reads as needing an import', async () => {
      const claimed = new Set(claimedFree(doc))
      const globals = [...await runtimeGlobals()].filter(doc.covers)

      expect(globals.filter(name => !claimed.has(name)).sort()).toEqual([])
    })
  })
}
