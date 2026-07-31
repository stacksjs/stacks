import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const actions = resolve('storage/framework/defaults/app/Actions/Dashboard/Kanban')

const atomicActions = [
  'BoardDestroyAction.ts',
  'BoardsReorderAction.ts',
  'CardAssigneesSyncAction.ts',
  'CardDestroyAction.ts',
  'CardLabelsSyncAction.ts',
  'CardsReorderAction.ts',
  'ColumnDestroyAction.ts',
  'ColumnsReorderAction.ts',
  'LabelDestroyAction.ts',
]

describe('dashboard kanban transaction contract', () => {
  test('keeps every multi-write operation atomic', () => {
    for (const file of atomicActions) {
      const source = readFileSync(resolve(actions, file), 'utf8')

      expect(source).toContain('await db.transaction(async (rawTrx) => {')
      expect(source).toContain('const qb = rawTrx as unknown as typeof db')
      expect(source).not.toContain('(db as any).transaction')
      expect(source).not.toContain('txOps(db)')
      expect(source).not.toContain('falling back')
      expect(source).not.toContain('best-effort sequential')
    }
  })
})
