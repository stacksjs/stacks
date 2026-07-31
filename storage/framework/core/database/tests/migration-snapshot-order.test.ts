import type { MigrationPlan } from '@stacksjs/query-builder'
import { describe, expect, it } from 'bun:test'
import { preserveMigrationPlanTableOrder } from '../src/migrations'

function plan(tables: string[]): MigrationPlan {
  return {
    dialect: 'sqlite',
    tables: tables.map(table => ({ table, columns: [], indexes: [] })),
  }
}

describe('migration snapshot ordering', () => {
  it('preserves existing table order and appends newly discovered tables', () => {
    const previous = plan(['zeta', 'alpha'])
    const next = plan(['alpha', 'new_table', 'zeta', 'other_new_table'])

    const stable = preserveMigrationPlanTableOrder(next, previous)

    expect(stable.tables.map(table => table.table)).toEqual([
      'zeta',
      'alpha',
      'new_table',
      'other_new_table',
    ])
    expect(next.tables.map(table => table.table)).toEqual([
      'alpha',
      'new_table',
      'zeta',
      'other_new_table',
    ])
  })

  it('uses discovery order when no snapshot exists', () => {
    const next = plan(['beta', 'alpha'])
    expect(preserveMigrationPlanTableOrder(next).tables.map(table => table.table)).toEqual(['beta', 'alpha'])
  })

  it('preserves existing column and index order and removes SQLite enum type metadata', () => {
    const previous: MigrationPlan = {
      dialect: 'sqlite',
      tables: [{
        table: 'users',
        columns: [
          { name: 'name', type: 'string', isPrimaryKey: false, isUnique: false, isNullable: false, hasDefault: false },
          { name: 'status', type: 'enum', isPrimaryKey: false, isUnique: false, isNullable: false, hasDefault: false, enumValues: ['active'] },
        ],
        indexes: [
          { name: 'users_name_index', columns: ['name'], type: 'index' },
          { name: 'users_status_index', columns: ['status'], type: 'index' },
        ],
      }],
    }
    const next: MigrationPlan = {
      dialect: 'sqlite',
      tables: [{
        table: 'users',
        columns: [
          { name: 'status', type: 'enum', isPrimaryKey: false, isUnique: false, isNullable: false, hasDefault: false, enumValues: ['active'], enumTypeName: 'users_status_type' },
          { name: 'email', type: 'string', isPrimaryKey: false, isUnique: false, isNullable: true, hasDefault: false },
          { name: 'name', type: 'string', isPrimaryKey: false, isUnique: false, isNullable: false, hasDefault: false },
        ],
        indexes: [
          { name: 'users_status_index', columns: ['status'], type: 'index' },
          { name: 'users_email_index', columns: ['email'], type: 'index' },
          { name: 'users_name_index', columns: ['name'], type: 'index' },
        ],
      }],
    }

    const stable = preserveMigrationPlanTableOrder(next, previous)
    expect(stable.tables[0]?.columns.map(column => column.name)).toEqual(['name', 'status', 'email'])
    expect(stable.tables[0]?.columns[1]?.enumTypeName).toBeUndefined()
    expect(stable.tables[0]?.indexes.map(index => index.name)).toEqual([
      'users_name_index',
      'users_status_index',
      'users_email_index',
    ])
  })
})
