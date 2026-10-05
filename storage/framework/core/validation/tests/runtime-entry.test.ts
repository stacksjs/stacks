import { describe, expect, it } from 'bun:test'
import { dirname, resolve } from 'node:path'

/**
 * `@stacksjs/validation/runtime` exists so that declaring a schema does not
 * cost the request validator.
 *
 * `./schema` is ~16 ms; `./validator` is ~149 ms, because it reaches
 * `@stacksjs/path`, `@stacksjs/strings`, `@stacksjs/utils` and
 * `@stacksjs/error-handling`. Paired fresh processes put the package root at
 * 145.9 ms / 52.2 MB and this entry at 17.5 ms / 15.1 MB, 15 of 15 pairs.
 *
 * One `export *` away from closing, so the shape is asserted rather than left
 * to a benchmark nobody runs.
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

describe('@stacksjs/validation/runtime', () => {
  it('binds the schema proxy', async () => {
    const entry = await import('../src/runtime')

    expect(entry.schema).toBeDefined()
    expect(typeof entry.schema.string).toBe('function')
  })

  it('re-exports only the schema module and ts-validation', async () => {
    const source = await Bun.file(`${SRC}/runtime.ts`).text()
    const reExports = [...new Set([...source.matchAll(/^export .*? from '(.+?)'/gm)].map(m => m[1]))]

    expect(reExports.sort()).toEqual(['./schema', '@stacksjs/ts-validation'])
  })

  /**
   * Order is load-bearing: `schema` must be bound before the ts-validation
   * star re-export, which also carries a `schema` symbol, or a consumer
   * arriving mid-evaluation through the auto-imports graph can see that one
   * instead of the Proxy. The barrel documents the same hazard.
   */
  it('binds schema before the ts-validation star re-export', async () => {
    const source = await Bun.file(`${SRC}/runtime.ts`).text()

    expect(source.indexOf("export { schema } from './schema'"))
      .toBeLessThan(source.indexOf("export * from '@stacksjs/ts-validation'"))
  })

  it('never reaches the request validator', async () => {
    const narrow = [...await localGraph(`${SRC}/runtime.ts`)].map(f => f.slice(SRC.length + 1))

    // Exact membership, so anything added to the entry fails here by name.
    expect(narrow.sort()).toEqual(['conditional.ts', 'file-validator.ts', 'object-with-context.ts', 'runtime.ts', 'schema.ts'])
    expect(narrow).not.toContain('validator.ts')
    expect(narrow).not.toContain('request-validator.ts')
  })
})
