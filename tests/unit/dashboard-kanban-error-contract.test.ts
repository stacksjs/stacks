import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('dashboard Kanban error contract', () => {
  const directory = resolve('storage/framework/defaults/app/Actions/Dashboard/Kanban')

  test('keeps validation responses distinct from operational failures', () => {
    const helper = readFileSync(resolve(directory, 'kanban-response.ts'), 'utf8')

    expect(helper).toContain("return kanbanError('The Kanban request could not be completed.', 500)")
    expect(helper).toContain('console.error(`[dashboard/kanban] ${action} failed:`, error)')
  })

  test('does not expose caught ORM or database errors', () => {
    const source = readdirSync(directory)
      .filter(file => file.endsWith('Action.ts'))
      .map(file => readFileSync(resolve(directory, file), 'utf8'))
      .join('\n')

    expect(source).not.toContain("instanceof Error ? err.message : 'unknown error'")
    expect(source).not.toContain("instanceof Error ? error.message : 'unknown error'")
    expect(source.match(/return kanbanActionError\(/g)?.length).toBe(24)
  })
})
