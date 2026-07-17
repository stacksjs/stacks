import { describe, expect, it } from 'bun:test'
import { groupGeneratedStatements } from '../src/migrations'

describe('generated migration grouping', () => {
  it('keeps a new model table and its indexes in one create migration', () => {
    const groups = groupGeneratedStatements([
      'CREATE TABLE IF NOT EXISTS "packages" ("id" BIGSERIAL PRIMARY KEY);',
      'CREATE INDEX IF NOT EXISTS "packages_status_idx" ON "packages" ("status");',
      'CREATE UNIQUE INDEX IF NOT EXISTS "packages_code_unique" ON "packages" ("code");',
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('create-packages-table')
    expect(groups[0]?.statements).toHaveLength(3)
  })

  it('keeps indexes for existing tables as standalone migrations', () => {
    const groups = groupGeneratedStatements([
      'CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");',
    ])

    expect(groups[0]?.label).toBe('create-users_email_idx-index-in-users')
  })
})
