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
const CEILING = 40

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

describe('UI/Table column types', () => {
  const TABLE = join(ROOT, 'UI/Table.stx')

  /** The component's script block, with comments stripped so prose cannot satisfy a match. */
  function script(): string {
    const source = readFileSync(TABLE, 'utf8')
    const open = source.indexOf('<script client>')
    const body = source.slice(open + '<script client>'.length, source.indexOf('</script>', open))
    return new Bun.Transpiler({ loader: 'ts' }).transformSync(body)
  }

  /** Every member of the `type?:` union on the column interface. */
  function declaredTypes(): string[] {
    const union = readFileSync(TABLE, 'utf8').match(/type\?:\s*((?:'[a-z]+'\s*\|\s*)*'[a-z]+')/)
    expect(union).not.toBeNull()
    return [...union![1].matchAll(/'([a-z]+)'/g)].map(match => match[1])
  }

  it('reads a non-empty union', () => {
    // Without this the assertions below pass on a regex that matched nothing.
    expect(declaredTypes().length).toBeGreaterThan(4)
    expect(declaredTypes()).toContain('currency')
  })

  /**
   * A type added to the renderer but not to the sort comparator falls through
   * to the string compare, which is wrong for everything but a coincidentally
   * ordered format - `datetime` sorted by string and was only accidentally
   * right for ISO timestamps. Types that genuinely sort as strings are listed
   * here on purpose, so adding one is a decision rather than an omission.
   */
  const STRING_SORTED = new Set(['text', 'badge'])

  it('sorts every column type it can render', () => {
    const body = script()
    const comparator = body.slice(body.indexOf('aMissing'))
    // The transpiler normalises string quoting, so match either style.
    const unsorted = declaredTypes().filter(type => !STRING_SORTED.has(type) && !new RegExp(`(['"])${type}\\1`).test(comparator))
    expect(unsorted).toEqual([])
  })
})

describe('UI/Table timestamp parsing', () => {
  const TABLE = join(ROOT, 'UI/Table.stx')

  function script(): string {
    const source = readFileSync(TABLE, 'utf8')
    const open = source.indexOf('<script client>')
    const body = source.slice(open + '<script client>'.length, source.indexOf('</script>', open))
    return new Bun.Transpiler({ loader: 'ts' }).transformSync(body)
  }

  /**
   * SQLite returns `2026-01-01 12:00:00` - a space, and no zone. `new Date()`
   * reads that as local time, so every row shifted by the viewer's offset and
   * a timestamp near midnight landed on the wrong day. Each hand-rolled table
   * normalised it itself; `toDate()` is that knowledge in one place, and every
   * site that turns a stored value into a Date has to go through it.
   */
  it('parses every stored timestamp through toDate', () => {
    const body = script()
    expect(body).toContain('function toDate')
    // `new Date(` is allowed only inside toDate itself.
    const withoutHelper = body.replace(/function toDate[\s\S]*?\n\}/, '')
    expect(withoutHelper).not.toContain('new Date(')
  })

  it('toDate rewrites a space-separated timestamp as UTC', () => {
    const body = script()
    const helper = body.match(/function toDate[\s\S]*?\n\}/)
    expect(helper).not.toBeNull()
    // The transpiler normalises string quoting, so match either style.
    expect(helper![0]).toMatch(/replace\((['"]) \1, \1T\1\)/)
    expect(helper![0]).toContain('Z')
  })
})

describe('UI/Table $slots usage', () => {
  const TABLE = join(ROOT, 'UI/Table.stx')

  /**
   * `$slots` only resolves as a standalone reference in an stx template.
   * Inside a compound expression - `:if="$slots.actions || hasRowActions()"` -
   * the whole condition evaluates falsy, so the element silently never
   * renders. That shipped the declarative `rowActions` column as a no-op: the
   * compiled output contained every guard and binding, `stx typecheck` was
   * clean, and the actions column simply was not there in the browser. Only
   * driving the real page found it. See stacksjs/stx#2098.
   */
  it('never puts $slots inside a compound condition', () => {
    const source = readFileSync(TABLE, 'utf8')
    const conditions = [...source.matchAll(/:(?:if|else-if)="([^"]*\$slots[^"]*)"/g)].map(match => match[1])

    // The guard is worthless if the file stopped using $slots at all.
    expect(conditions.length).toBeGreaterThan(0)

    const compound = conditions.filter(condition => /\|\||&&|[!?]/.test(condition))
    expect(compound).toEqual([])
  })
})
