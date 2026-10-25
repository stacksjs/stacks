/**
 * What the published `dist/*.d.ts` says, not what this repo infers.
 *
 * `bun-plugin-dtsx` cannot infer a class field from `new Map<string, string>()`
 * or a parameter from a numeric default like `12_000`, and emits `unknown`.
 * Inside this repo the import resolves to the source, where inference works,
 * so a type-level test passes either way; an app installing the package got
 * `cdp.inFlight: unknown`. These run the same emitter over the source.
 */
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { processSource } from '@stacksjs/dtsx'

const emit = async (file: string) => processSource(await Bun.file(join(import.meta.dir, '../src', file)).text(), file)

/** Declaration lines that published `unknown` where the source meant something. */
const unknowns = (declarations: string) => declarations.split('\n')
  .filter(line => !line.trim().startsWith('*') && /:\s*unknown\b/.test(line.replace(/Record<string, unknown>/g, '')))

describe('published declarations', () => {
  test('the emitter still needs annotations (control)', () => {
    expect(processSource('export class A { m = new Map<string, string>() }', 'a.ts')).toContain('m: unknown')
  })

  test('browser.d.ts types the Cdp session and every default', async () => {
    const declarations = await emit('browser.ts')
    expect(declarations).not.toContain('defaults/ai/')
    expect(declarations).toContain('prepareMacChrome(options?: {')
    expect(declarations).toContain('inFlight: Map<string, string>;')
    expect(declarations).toContain('closed: boolean;')
    expect(declarations).toContain('readonly diagnostics: ChromeLaunchDiagnostics;')
    expect(declarations).toContain('intercept(patterns: FetchPattern[], handler: FetchHandler): Promise<() => Promise<void>>;')
    // JavaScript can throw any value. That explicitly typed cause is the only
    // intended unknown; inferred CDP fields/defaults must remain concrete.
    expect(unknowns(declarations)).toEqual([
      '  constructor(cause: unknown, diagnostics: ChromeLaunchDiagnostics);',
    ])
  })

  test('isolated.d.ts carries the bunfig option', async () => {
    const declarations = await emit('isolated.ts')
    expect(declarations).toContain('bunfig?: string')
    expect(unknowns(declarations)).toEqual([])
  })
})
