import { describe, expect, it } from 'bun:test'
import { primitiveAutoImportEntries, primitiveModules } from '../src/primitive-imports'

describe('server primitive auto-imports', () => {
  it('generates declarations for runtime globals', () => {
    const entries = primitiveAutoImportEntries()

    expect(entries).toContainEqual({ from: '@stacksjs/database', name: 'db', as: 'db' })
    expect(entries).toContainEqual({ from: '@stacksjs/actions', name: 'Action', as: 'Action' })
    expect(entries).toContainEqual({ from: '@stacksjs/router', name: 'response', as: 'response' })
  })

  it('does not generate duplicate global names', () => {
    const names = primitiveModules.flatMap(([, exports]) => exports)

    expect(new Set(names).size).toBe(names.length)
  })
})
