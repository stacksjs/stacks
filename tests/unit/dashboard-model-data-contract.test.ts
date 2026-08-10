import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const dataSource = readFileSync(resolve(root, 'storage/framework/defaults/resources/functions/dashboard/data.ts'), 'utf8')
const indexSource = readFileSync(resolve(root, 'storage/framework/defaults/app/Actions/Dashboard/Models/ModelsIndexAction.ts'), 'utf8')
const showSource = readFileSync(resolve(root, 'storage/framework/defaults/app/Actions/Dashboard/Models/ModelShowAction.ts'), 'utf8')

describe('dashboard model data integrity contract', () => {
  test('never substitutes stub models or swallowed query failures', () => {
    expect(dataSource).not.toContain('makeStub')
    expect(dataSource).not.toContain('_isStub')
    expect(dataSource).not.toContain('safeAll')
    expect(dataSource).not.toContain('safeCount')
    expect(dataSource).toContain('throw new DashboardModelLoadError')
  })

  test('reports unavailable model counts explicitly', () => {
    expect(indexSource).toContain('count: number | null')
    expect(indexSource).toContain('unavailableModels')
    expect(indexSource).toContain('error: string | null')
    expect(indexSource).toContain("dashboardOperationalIssue(cause, 'Model count could not be loaded.'")
    expect(indexSource).not.toContain('count: 0,')
    expect(indexSource).not.toContain('cause instanceof Error ? cause.message')
    expect(indexSource).not.toContain('error instanceof Error ? error.message')
  })

  test('keeps every model query on the native ORM path', () => {
    expect(showSource).toContain('chain.whereGroup((group: any) => {')
    expect(showSource).toContain('group.orWhereLike(column, `%${q}%`)')
    expect(showSource).toContain("dashboardOperationalError(error, `${modelName} records could not be loaded.`, 'ModelShowAction.query')")
    expect(showSource).not.toContain('SearchUnsupported')
    expect(showSource).not.toContain('sqlite-fallback')
    expect(showSource).not.toContain("import('bun:sqlite')")
  })

  test('projects hidden model attributes out before rows are serialized', () => {
    expect(showSource).toContain('const hiddenColumns = hiddenModelColumns(Model)')
    expect(showSource).toContain('!hiddenColumns.has(k)')
    expect(showSource).toContain('modelSchemaColumns(Model).filter(column => !hiddenColumns.has(column))')
    expect(showSource).not.toContain('for (const col of response.displayColumns)')
  })
})
