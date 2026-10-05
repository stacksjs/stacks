import { describe, expect, it } from 'bun:test'
import { primitiveAutoImportEntries, primitiveModules } from '../src/primitive-imports'

describe('server primitive auto-imports', () => {
  it('generates declarations for runtime globals', () => {
    const entries = primitiveAutoImportEntries()

    expect(entries).toContainEqual({ from: '@stacksjs/database/runtime', name: 'db', as: 'db' })
    expect(entries).toContainEqual({ from: '@stacksjs/actions/runtime', name: 'Action', as: 'Action' })
    expect(entries).toContainEqual({ from: '@stacksjs/router', name: 'response', as: 'response' })
  })

  /**
   * Every global here is imported at server boot, so a package whose root
   * barrel carries build-time tooling has to be injected through its narrow
   * entry instead. `@stacksjs/actions` is the case that proves the cost:
   * measured in paired fresh processes, its root takes 175 ms and 65 MB to
   * yield `Action`, and `./runtime` takes 1.3 ms and 4.7 MB.
   *
   * This is a rule rather than a value assertion, so widening one back to the
   * barrel fails here rather than quietly costing every boot.
   */
  it('injects packages that have a narrow runtime entry through it', () => {
    const NARROW = ['@stacksjs/actions', '@stacksjs/database']

    for (const pkg of NARROW) {
      const sources = primitiveModules.map(([from]) => from)
      expect(sources).not.toContain(pkg)
      expect(sources).toContain(`${pkg}/runtime`)
    }
  })

  it('does not generate duplicate global names', () => {
    const names = primitiveModules.flatMap(([, exports]) => exports)

    expect(new Set(names).size).toBe(names.length)
  })
})
