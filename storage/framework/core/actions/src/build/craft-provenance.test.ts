import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { resolveCraftBuilderProvenance } from './craft-provenance'

describe('Craft builder provenance', () => {
  it('identifies package resolution without inventing a revision', () => {
    expect(resolveCraftBuilderProvenance()).toEqual({
      package: 'craft-native',
      source: 'package',
    })
  })

  it('records the revision for an explicit source checkout', () => {
    const provenance = resolveCraftBuilderProvenance(join(import.meta.dir, 'ios.ts'))
    expect(provenance.package).toBe('craft-native')
    expect(provenance.source).toBe('path')
    expect(provenance.revision).toMatch(/^[\da-f]{40}$/)
  })
})
