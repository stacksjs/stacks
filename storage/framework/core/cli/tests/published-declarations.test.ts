/**
 * Exports must carry a type the DECLARATION EMIT can keep
 * (stacksjs/stacks#2389).
 *
 * `quotes` was written `export const quotes = collect([...])` and inferred
 * `CollectionOperations<string>` perfectly well inside this repo. It did not
 * survive the package boundary: `bun-plugin-dtsx` could not follow the type
 * out through the `@stacksjs/collections` re-export and published
 *
 *     export declare const quotes: unknown;
 *
 * so a freshly scaffolded app - which resolves `@stacksjs/cli` from its
 * PUBLISHED dist, not from this source - failed its own `buddy typecheck` on
 * the `inspire` command the scaffold ships:
 *
 *     error TS18046: 'quotes' is of type 'unknown'.
 *     error TS7006: Parameter 'quote' implicitly has an 'any' type.
 *
 * A type-level test cannot catch this. In this repo the import resolves to the
 * source above, where inference works either way, so `quotes` checks out as
 * `CollectionOperations<string>` whether or not the annotation is there. The
 * only thing that differs is what gets EMITTED, which is why this asserts on
 * the source text.
 *
 * The repo already has the rule that prevents this class: `isolatedDeclarations`
 * is set in `core/tsconfig.build.json` and flags the unannotated form as
 * TS9010, "Variable must have an explicit type annotation". Nothing runs that
 * config in CI though - it reports 1909 errors repo-wide today - so the guard
 * is inert and this stands in for it here.
 */
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

const utilsSource = await Bun.file(join(import.meta.dir, '../src/utils.ts')).text()

describe('declaration emit survives the package boundary (#2389)', () => {
  it('annotates the quotes export explicitly', () => {
    // Not `export const quotes = collect([`, which publishes as `unknown`.
    expect(utilsSource).toContain('export const quotes: CollectionOperations<string> = collect([')
  })

  it('imports the annotation as a type, so it costs no runtime', () => {
    expect(utilsSource).toContain("import type { CollectionOperations } from '@stacksjs/collections'")
  })

  it('control: quotes is still exported and still built by collect', () => {
    // Without this, deleting the export satisfies both assertions above by
    // making them unreachable rather than true.
    expect(utilsSource).toMatch(/export const quotes[^=]*= collect\(\[/)
  })
})
