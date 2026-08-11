import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const contentActions = resolve('storage/framework/defaults/app/Actions/Dashboard/Content')

function readAction(name: string): string {
  return readFileSync(resolve(contentActions, name), 'utf8')
}

const readActions = [
  'AuthorIndexAction.ts',
  'CategoryIndexAction.ts',
  'CommentIndexAction.ts',
  'ContentDashboardAction.ts',
  'PageIndexAction.ts',
  'PostIndexAction.ts',
  'TagIndexAction.ts',
]

const writeActions = [
  'AuthorDestroyAction.ts',
  'AuthorStoreAction.ts',
  'AuthorUpdateAction.ts',
  'CategoryDestroyAction.ts',
  'CategoryStoreAction.ts',
  'CommentDestroyAction.ts',
  'CommentUpdateAction.ts',
  'PageDestroyAction.ts',
  'PageStoreAction.ts',
  'PageUpdateAction.ts',
  'PostDestroyAction.ts',
  'PostStoreAction.ts',
  'PostUpdateAction.ts',
  'TagDestroyAction.ts',
  'TagStoreAction.ts',
]

describe('dashboard content error contract', () => {
  test('returns a safe unavailable response for every database-backed content read', () => {
    for (const action of readActions) {
      const source = readAction(action)

      expect(source).toContain("import { dashboardOperationalError } from '../dashboard-response'")
      expect(source).toContain('catch (error)')
      expect(source).toContain('return dashboardOperationalError(error,')
      expect(source).not.toContain('error instanceof Error ? error.message')
    }
  })

  test('returns a safe server error for every database-backed content write', () => {
    for (const action of writeActions) {
      const source = readAction(action)

      expect(source).toContain("import { dashboardOperationalError } from '../dashboard-response'")
      expect(source).toContain('catch (error)')
      expect(source).toContain(', 500)')
      expect(source).not.toContain('error instanceof Error ? error.message')
    }
  })

  test('keeps validation, absence, and uniqueness responses distinct', () => {
    const sources = [...readActions, ...writeActions].map(readAction).join('\n')

    expect(sources).toContain("response.json({ message: 'A valid post id is required.' }, 422)")
    expect(sources).toContain("response.json({ message: 'Post not found.' }, 404)")
    expect(sources).toContain("response.json({ message: 'An author with that email already exists.' }, 422)")
  })

  test('commits each content mutation and its readback as one transaction', () => {
    for (const action of writeActions) {
      const source = readAction(action)

      expect(source).toMatch(/import \{[^\n]*transaction[^\n]*\} from '@stacksjs\/orm'/)
      expect(source).toContain('transaction(async (rawTrx) => {')
      expect(source).toContain('const trx = rawTrx as unknown as typeof db')
    }

    const postStore = readAction('PostStoreAction.ts')
    const postUpdate = readAction('PostUpdateAction.ts')
    const postDestroy = readAction('PostDestroyAction.ts')
    const relationHelper = readAction('post-input.ts')

    expect(postStore).toContain('syncPostRelations(trx, id, payload)')
    expect(postUpdate).toContain('syncPostRelations(trx, id, payload)')
    expect(postDestroy).toContain('detachPostRelations(trx, id)')
    expect(relationHelper).toContain('export async function syncPostRelations(database: typeof db')
    expect(relationHelper).toContain('export async function detachPostRelations(database: typeof db')
  })
})
