import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The chrome around a dashboard table, as the Users and Teams pages showed it:
 * a header in its column's code font, a table framed inside a card that was
 * already framed, a pager for five rows, and stats that left a hole.
 */

const read = (file: string) => readFileSync(resolve('storage/framework/defaults/resources/components/Dashboard', file), 'utf8')
const table = read('UI/Table.stx')
const records = read('Data/DataRecords.stx')

/** The body of a function in a component's script, up to its closing brace. */
function body(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`)
  expect(start).toBeGreaterThan(-1)
  return source.slice(start, source.indexOf('\n}\n', start))
}

describe('dashboard table chrome', () => {
  test('a column\'s cell classes stay off its header', () => {
    expect(body(table, 'headerClass')).not.toContain('column.class')
    expect(body(table, 'cellClass')).toContain('column.class')
  })

  test('a table can leave the frame to the card it sits in', () => {
    expect(table).toContain(`const framed = useReactiveProp('framed', true)`)
    expect(table).toMatch(/:class="framed\(\) \? 'border border-stone-200\/80 rounded-xl/)
    for (const file of ['Data/DataRecords.stx', 'Content/SeoDashboard.stx', 'Auth/AccessTokens.stx', 'App/SourceInventory.stx', 'App/RequestsOverview.stx'])
      expect(read(file), file).toContain(':framed="false"')
  })

  test('the pager shows only when the rows do not fit on the smallest page', () => {
    expect(body(table, 'needsPager')).toContain('Math.min(...pageSizeOptions(), pageSize())')
    expect(table).toContain(':if="paginated() && needsPager()"')
  })

  test('the records page counts in plain words and fills its stats row', () => {
    expect(records).not.toContain('loaded records')
    expect(records).toContain('{{ countLabel() }}')
    expect(records).toContain(`page().cards === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'`)
    expect(records).toContain(`recorded('updatedAt', 'Updated', 'Not since registering')`)
  })
})
