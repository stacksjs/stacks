import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('migration scaffold contract', () => {
  test('creates SQL migrations that the active runner discovers', () => {
    const make = readFileSync(resolve('storage/framework/core/actions/src/make.ts'), 'utf8')
    const templates = readFileSync(resolve('storage/framework/core/actions/src/templates.ts'), 'utf8')
    const migrations = readFileSync(resolve('storage/framework/core/database/src/migrations.ts'), 'utf8')

    expect(make).toContain("const fileName = `${Date.now()}-${kebabCase(optionName)}.sql`")
    expect(templates).toContain('migration: `CREATE TABLE')
    expect(templates).not.toContain("migration: `import type { Database }")
    expect(migrations).toContain("filter(f => f.endsWith('.sql'))")
    expect(make).toContain("driver === 'mysql' || driver === 'singlestore'")
    expect(make).toContain('BIGSERIAL PRIMARY KEY')
    expect(make).toContain('AUTO_INCREMENT PRIMARY KEY')
    expect(make).toContain('INTEGER PRIMARY KEY AUTOINCREMENT')
  })
})
