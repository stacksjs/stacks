import { describe, expect, it } from 'bun:test'
import { dirname, resolve } from 'node:path'

/**
 * `@stacksjs/actions/runtime` exists so that declaring an action does not cost
 * the action layer's build-time tooling.
 *
 * Measured in paired fresh processes with the application's Bun preloads off,
 * the package root takes 175 ms and 65 MB to yield `Action`, and this entry
 * takes 1.3 ms and 4.7 MB. 15 of 15 pairs. That gap is the whole point, and it
 * is one careless `export *` away from closing, so the shape is asserted here
 * rather than left to a benchmark nobody runs.
 */
const SRC = resolve(import.meta.dir, '../src')

/** Every local module reachable from an entry, following relative imports. */
async function localGraph(entry: string): Promise<Set<string>> {
  const seen = new Set<string>()
  const queue = [entry]

  while (queue.length) {
    const file = queue.shift()!
    if (seen.has(file))
      continue
    seen.add(file)

    const source = await Bun.file(file).text()
    const specifiers = [...source.matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g)].map(m => m[1])

    for (const specifier of specifiers) {
      const base = resolve(dirname(file), specifier)
      for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
        if (await Bun.file(candidate).exists() && candidate.endsWith('.ts')) {
          queue.push(candidate)
          break
        }
      }
    }
  }

  return seen
}

describe('@stacksjs/actions/runtime', () => {
  it('exposes the action contract', async () => {
    const entry = await import('../src/runtime')

    expect(typeof entry.Action).toBe('function')
  })

  it('re-exports the action module and nothing else', async () => {
    const source = await Bun.file(`${SRC}/runtime.ts`).text()
    const reExports = [...source.matchAll(/^export .*? from '(.+?)'/gm)].map(m => m[1])

    expect(reExports).toEqual(['./action'])
  })

  it('reaches two local modules', async () => {
    const narrow = await localGraph(`${SRC}/runtime.ts`)

    // Exact membership, so adding anything to the entry fails here by name.
    expect([...narrow].map(f => f.slice(SRC.length + 1)).sort()).toEqual(['action.ts', 'runtime.ts'])
  })

  /**
   * This is the mechanism, not the module count. The root's own local graph is
   * only ~36 files; the 175 ms is in the workspace packages those files pull at
   * runtime, each dragging its own barrel. The narrow entry's graph imports
   * `@stacksjs/types` for types alone, which is erased, so it loads no
   * framework package at all.
   */
  it('loads no framework package at runtime', async () => {
    const narrow = await localGraph(`${SRC}/runtime.ts`)

    const valueImports: string[] = []
    for (const file of narrow) {
      const source = await Bun.file(file).text()
      for (const match of source.matchAll(/^(import|export)(\s+type)?\s[^'"]*?from\s*['"](@stacksjs\/[^'"]+)['"]/gm)) {
        const [, , typeOnly, specifier] = match
        if (!typeOnly)
          valueImports.push(specifier)
      }
    }

    expect(valueImports).toEqual([])
  })
})
