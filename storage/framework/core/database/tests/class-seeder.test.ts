import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runClassSeeders, Seeder, topoSortSeeders } from '../src/class-seeder'

describe('topoSortSeeders', () => {
  it('falls back to alphabetical when no dependencies are declared', () => {
    const order = topoSortSeeders([
      { name: 'ReviewSeeder' },
      { name: 'CourtHouseSeeder' },
      { name: 'JudgeSeeder' },
    ])
    expect(order).toEqual(['CourtHouseSeeder', 'JudgeSeeder', 'ReviewSeeder'])
  })

  it('honors explicit dependencies and breaks ties alphabetically', () => {
    const order = topoSortSeeders([
      { name: 'ReviewSeeder', dependencies: ['JudgeSeeder'] },
      { name: 'JudgeSeeder', dependencies: ['CourtHouseSeeder'] },
      { name: 'CourtHouseSeeder' },
      { name: 'UnrelatedSeeder' },
    ])
    // Kahn's with per-step alphabetical re-sort runs the dependency chain to
    // completion before falling back to siblings — `CourtHouseSeeder` unblocks
    // `JudgeSeeder` which sorts ahead of `UnrelatedSeeder` ('J' < 'U').
    expect(order).toEqual(['CourtHouseSeeder', 'JudgeSeeder', 'ReviewSeeder', 'UnrelatedSeeder'])
  })

  it('drops unknown dependency names without failing', () => {
    const order = topoSortSeeders([
      { name: 'JudgeSeeder', dependencies: ['DoesNotExistSeeder'] },
      { name: 'CourtHouseSeeder' },
    ])
    expect(order).toEqual(['CourtHouseSeeder', 'JudgeSeeder'])
  })

  it('ignores self-dependencies', () => {
    const order = topoSortSeeders([
      { name: 'A', dependencies: ['A'] },
      { name: 'B' },
    ])
    expect(order).toEqual(['A', 'B'])
  })

  it('throws on a 2-node cycle with both names in the message', () => {
    expect(() => topoSortSeeders([
      { name: 'A', dependencies: ['B'] },
      { name: 'B', dependencies: ['A'] },
    ])).toThrow(/Cycle.*A.*B|Cycle.*B.*A/)
  })

  it('throws on a 3-node cycle and names every member', () => {
    let captured: Error | null = null
    try {
      topoSortSeeders([
        { name: 'A', dependencies: ['C'] },
        { name: 'B', dependencies: ['A'] },
        { name: 'C', dependencies: ['B'] },
      ])
    }
    catch (err) {
      captured = err as Error
    }
    expect(captured).not.toBeNull()
    expect(captured!.message).toContain('A')
    expect(captured!.message).toContain('B')
    expect(captured!.message).toContain('C')
  })

  it('returns an empty list for an empty input', () => {
    expect(topoSortSeeders([])).toEqual([])
  })

  it('reproduces the bench-review case from #1855 with explicit deps', () => {
    // CourtHouse → Judge → Review (the exact scenario in the issue).
    const order = topoSortSeeders([
      { name: 'ReviewSeeder', dependencies: ['JudgeSeeder'] },
      { name: 'JudgeSeeder', dependencies: ['CourtHouseSeeder'] },
      { name: 'CourtHouseSeeder' },
    ])
    expect(order).toEqual(['CourtHouseSeeder', 'JudgeSeeder', 'ReviewSeeder'])
  })
})

describe('runClassSeeders ordering (integration)', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'stacks-seeders-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('runs seeders alphabetically when no dependencies are declared', async () => {
    // Names chosen so the bench-review reverse-alphabetical bug would surface
    // if we ever drop the sort: ReviewSeeder, JudgeSeeder, CourtHouseSeeder.
    await writeFile(
      join(dir, 'ReviewSeeder.ts'),
      `export default class ReviewSeeder {
         async run() { (globalThis as any).__order.push('ReviewSeeder') }
       }`,
    )
    await writeFile(
      join(dir, 'JudgeSeeder.ts'),
      `export default class JudgeSeeder {
         async run() { (globalThis as any).__order.push('JudgeSeeder') }
       }`,
    )
    await writeFile(
      join(dir, 'CourtHouseSeeder.ts'),
      `export default class CourtHouseSeeder {
         async run() { (globalThis as any).__order.push('CourtHouseSeeder') }
       }`,
    )

    ;(globalThis as any).__order = []
    const result = await runClassSeeders({ dir })

    expect(result.ran).toEqual(['CourtHouseSeeder', 'JudgeSeeder', 'ReviewSeeder'])
    expect((globalThis as any).__order).toEqual(['CourtHouseSeeder', 'JudgeSeeder', 'ReviewSeeder'])
  })

  it('honors explicit `dependencies` to override alphabetical order', async () => {
    // Z depends on A; alphabetical would put A first anyway, so make it
    // counter-intuitive: A depends on Z. Result should be Z, then A.
    await writeFile(
      join(dir, 'ASeeder.ts'),
      `export default class ASeeder {
         dependencies = ['ZSeeder']
         async run() { (globalThis as any).__order.push('ASeeder') }
       }`,
    )
    await writeFile(
      join(dir, 'ZSeeder.ts'),
      `export default class ZSeeder {
         async run() { (globalThis as any).__order.push('ZSeeder') }
       }`,
    )

    ;(globalThis as any).__order = []
    const result = await runClassSeeders({ dir })

    expect(result.ran).toEqual(['ZSeeder', 'ASeeder'])
    expect((globalThis as any).__order).toEqual(['ZSeeder', 'ASeeder'])
  })

  it('skips files starting with _ and non-.ts entries', async () => {
    await writeFile(
      join(dir, '_helper.ts'),
      `export default class Helper {}`,
    )
    await writeFile(
      join(dir, 'README.md'),
      'docs',
    )
    await writeFile(
      join(dir, 'RealSeeder.ts'),
      `export default class RealSeeder {
         async run() {}
       }`,
    )

    const result = await runClassSeeders({ dir })
    expect(result.ran).toEqual(['RealSeeder'])
  })
})

describe('Seeder base class', () => {
  it('exposes optional `dependencies` field on instances', () => {
    class CourtHouseSeeder extends Seeder {
      async run() {}
    }
    class JudgeSeeder extends Seeder {
      dependencies = ['CourtHouseSeeder']
      async run() {}
    }

    expect(new CourtHouseSeeder().dependencies).toBeUndefined()
    expect(new JudgeSeeder().dependencies).toEqual(['CourtHouseSeeder'])
  })
})
