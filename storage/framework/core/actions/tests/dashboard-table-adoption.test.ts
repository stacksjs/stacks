import { readFileSync } from 'node:fs'
import { Glob } from 'bun'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

/**
 * `UI/Table.stx` is 729 lines of sorting, filtering, column toggling, search
 * and paging, and for a long time it had no callers at all: 69 dashboard
 * components hand-rolled a `<table>` instead, and 42 of those paginated
 * nowhere, in this component or in any parent that renders it. See
 * stacksjs/stacks#2924.
 *
 * This is a ratchet, not a ban. The count may only go down, so a migration is
 * recorded by lowering CEILING and a new hand-rolled table fails. The ceiling
 * is deliberately an exact equality on the way down too: a sweep that lands
 * without updating it reads as "no progress", which is the failure mode this
 * is here to prevent.
 */

const ROOT = join(import.meta.dir, '../../../defaults/resources/components/Dashboard')

/** Lower this when a migration lands. Never raise it. */
const CEILING = 68

function components(): string[] {
  return [...new Glob('**/*.stx').scanSync(ROOT)].map(rel => join(ROOT, rel)).sort()
}

function handRolled(): string[] {
  return components().filter((file) => {
    if (file.endsWith(`${'UI'}/Table.stx`))
      return false
    return readFileSync(file, 'utf8').includes('<table')
  })
}

describe('dashboard table adoption', () => {
  it('has components to measure at all', () => {
    // Without this, an empty glob would make every assertion below pass.
    expect(components().length).toBeGreaterThan(200)
  })

  it('does not add hand-rolled tables, and records every migration', () => {
    const remaining = handRolled().map(file => file.slice(ROOT.length + 1))
    expect(remaining.length).toBe(CEILING)
  })

  it('the primitive has real callers', () => {
    const callers = components().filter(file => /<Table(?=[\s/>])/.test(readFileSync(file, 'utf8')))
    expect(callers.length).toBeGreaterThan(0)
  })

  it('a migrated component paginates rather than rendering every row', () => {
    // Table's `paginated` prop defaults to false, so adopting the primitive is
    // not on its own enough - the caller has to ask for paging.
    const migrated = join(ROOT, 'Library/DependenciesDashboard.stx')
    const source = readFileSync(migrated, 'utf8')
    expect(source).not.toContain('<table')
    expect(source).toMatch(/<Table(?=[\s/>])/)
    expect(source).toContain('paginated')
  })
})
