import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const actions = resolve('storage/framework/defaults/app/Actions/Dashboard/Kanban')

const storeModels: Record<string, string[]> = {
  'BoardStoreAction.ts': ['Board'],
  'ColumnStoreAction.ts': ['Board', 'BoardColumn'],
  'CardStoreAction.ts': ['BoardColumn', 'Card'],
  'LabelStoreAction.ts': ['Board', 'Label'],
}

describe('dashboard kanban model contract', () => {
  test('creates Kanban records through exported useApi models', () => {
    for (const [file, models] of Object.entries(storeModels)) {
      const source = readFileSync(resolve(actions, file), 'utf8')

      expect(source).toContain("from '@stacksjs/orm'")
      expect(source).not.toContain('.insertInto(')
      expect(source).not.toContain('follow-up read')
      expect(source).not.toContain('best-effort')

      for (const model of models)
        expect(source).toMatch(new RegExp(`\\b${model}\\.(?:create|find|where)\\(`))
    }
  })
})
