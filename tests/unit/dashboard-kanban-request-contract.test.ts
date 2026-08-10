import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const actionsDirectory = resolve('storage/framework/defaults/app/Actions/Dashboard/Kanban')

function requestActions(): Array<{ file: string, source: string }> {
  return readdirSync(actionsDirectory)
    .filter(file => file.endsWith('Action.ts'))
    .map(file => ({ file, source: readFileSync(resolve(actionsDirectory, file), 'utf8') }))
    .filter(action => action.source.includes('async handle(request'))
}

describe('dashboard Kanban request contract', () => {
  test('uses the typed native request surface in every request action', () => {
    const actions = requestActions()

    expect(actions.length).toBeGreaterThan(0)
    for (const { file, source } of actions) {
      expect(source, file).toContain("import type { RequestInstance } from '@stacksjs/types'")
      expect(source, file).toMatch(/async handle\(request: RequestInstance(?:<[^>]+>)?\)/)
      expect(source, file).not.toContain('request as any')
      expect(source, file).not.toContain('request.jsonBody')
      expect(source, file).not.toContain('_authenticatedUser')
    }
  })

  test('reads route ids and bodies through request helpers', () => {
    for (const { file, source } of requestActions()) {
      if (source.includes("getParam('id')"))
        expect(source, file).toContain("request.getParam('id')")

      if (/RequestInstance<[^>]+>/.test(source))
        expect(source, file).toContain('request.all()')
    }
  })

  test('resolves authenticated attribution through request.user()', () => {
    for (const file of [
      'CardStoreAction.ts',
      'CardCommentStoreAction.ts',
      'CardAssigneesSyncAction.ts',
    ]) {
      const source = readFileSync(resolve(actionsDirectory, file), 'utf8')

      expect(source).toContain('await request.user()')
    }
  })
})
