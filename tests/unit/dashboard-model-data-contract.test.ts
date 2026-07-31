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
    expect(indexSource).not.toContain('count: 0,')
  })

  test('does not replace ORM query failures with raw SQLite reads', () => {
    expect(showSource).toContain('if (e instanceof SearchUnsupported)')
    expect(showSource).toContain('Could not query model')
    expect(showSource).toContain('Model table "${response.tableName}" does not exist.')
    expect(showSource).not.toContain("if (!(e instanceof SearchUnsupported))")
  })
})
