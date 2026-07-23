import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { danglingFixtureRequirements, duplicateRequirementIds } from './sync-suite'

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

// Fixtures must reference real catalog requirements and unblock formal conformance
// reports (stacksjs/stacks#2051). `protocol:check` now enforces corpus integrity.
describe('protocol fixture-corpus integrity (stacksjs/stacks#2051)', () => {
  const catalogIds = new Set(['CORE-CONV-01', 'CORE-CONV-02', 'CORE-MVA-01'])

  it('reports no dangling refs when every requirement resolves', () => {
    const fixtures = [
      { id: 'fixture.a', requirements: ['CORE-CONV-01', 'CORE-CONV-02'] },
      { id: 'fixture.b', requirements: ['CORE-MVA-01'] },
    ]
    expect(danglingFixtureRequirements(fixtures, catalogIds)).toEqual([])
  })

  it('reports each unknown requirement ref as `fixture -> requirement`', () => {
    const fixtures = [
      { id: 'fixture.a', requirements: ['CORE-CONV-01', 'CORE-GONE-99'] },
      { id: 'fixture.b', requirements: ['NOPE-01'] },
    ]
    expect(danglingFixtureRequirements(fixtures, catalogIds)).toEqual(['fixture.a -> CORE-GONE-99', 'fixture.b -> NOPE-01'])
  })

  it('tolerates fixtures with no requirements', () => {
    expect(danglingFixtureRequirements([{ id: 'fixture.a' }], catalogIds)).toEqual([])
  })

  it('the vendored fixture corpus has unique ids and no dangling requirement refs', () => {
    const base = resolve(import.meta.dir, '../../protocol/suite/1.0-draft')
    const corpus = JSON.parse(readFileSync(resolve(base, 'fixtures/conformance.json'), 'utf8')) as {
      fixtures: Array<{ id: string, requirements?: string[] }>
    }
    const catalog = JSON.parse(readFileSync(resolve(base, 'catalog.json'), 'utf8')) as { requirements: Array<{ id: string }> }
    const realIds = new Set(catalog.requirements.map(requirement => requirement.id))

    expect(corpus.fixtures.length).toBeGreaterThan(0)
    expect(duplicateRequirementIds(corpus.fixtures.map(fixture => fixture.id))).toEqual([])
    expect(danglingFixtureRequirements(corpus.fixtures, realIds)).toEqual([])
  })
})
