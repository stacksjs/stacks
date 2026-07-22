import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { duplicateRequirementIds } from './sync-suite'

// Protocol 1.0 ratification requires requirement ids to be unique and validated
// in CI (stacksjs/stacks#2050). `protocol:check` now enforces this on the
// vendored catalog; these cover the pure detector plus a regression guard on
// the real catalog.
describe('protocol requirement-id uniqueness (stacksjs/stacks#2050)', () => {
  it('reports no duplicates for a unique list', () => {
    expect(duplicateRequirementIds(['CORE-CONV-01', 'CORE-CONV-02', 'CORE-MVA-01'])).toEqual([])
  })

  it('reports each duplicated id once, sorted', () => {
    expect(duplicateRequirementIds(['B-1', 'A-1', 'B-1', 'A-1', 'A-1', 'C-1'])).toEqual(['A-1', 'B-1'])
  })

  it('handles an empty list', () => {
    expect(duplicateRequirementIds([])).toEqual([])
  })

  it('the vendored catalog.json has unique requirement ids', () => {
    const catalog = JSON.parse(readFileSync(resolve(import.meta.dir, '../../protocol/suite/1.0-draft/catalog.json'), 'utf8')) as {
      requirements: Array<{ id: string }>
    }
    const ids = catalog.requirements.map(requirement => requirement.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(duplicateRequirementIds(ids)).toEqual([])
  })
})
