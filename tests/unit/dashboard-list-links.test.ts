import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Where the dashboard draws a model's chosen columns, and a link to another
 * record by that record's name (stacksjs/stacks#3259). Driven in a browser
 * against real pages; these pin what that run relied on.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('a model\'s list and its record\'s page', () => {
  const components = 'storage/framework/defaults/resources/components/Dashboard'

  test('the list draws the name as a link to that record', () => {
    const browser = source(`${components}/Models/ModelRecordsDashboard.stx`)
    expect(browser).toContain('return modelRelationCell(column.name, row[column.name], relations(), relationNames())')
    expect(browser).toContain('<StxLink :if="relationHref(row, column)" :to="relationHref(row, column)"')
    expect(browser).toContain('<span :if="!relationHref(row, column)">{{ cellValue(row, column) }}</span>')
    expect(browser).toContain('const shown = modelListColumnNames(every.map(column => column.name), data.listColumns, active)')
  })

  test('a record\'s page has its names with the record, and asks for nothing more', () => {
    const page = source(`${components}/Models/ModelRecordDetail.stx`)
    expect(page).toContain('modelRecordSections(record()!)')
    expect(page).not.toContain('fetchModelRelationNames')
    const record = source('storage/framework/defaults/functions/dashboard-model-record.ts')
    expect(record).not.toContain('export async function fetchModelRelationNames')
    expect(record).toContain('names: ModelRelationNames = record.relationNames ?? {}')
  })
})
