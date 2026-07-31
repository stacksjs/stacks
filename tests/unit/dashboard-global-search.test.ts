import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('dashboard global search', () => {
  test('queries only fields declared by model useSearch traits', () => {
    const action = source('storage/framework/defaults/app/Actions/Dashboard/Search/GlobalSearchAction.ts')

    expect(action).toContain('definition.traits?.useSearch')
    expect(action).toContain('Array.isArray(search.searchable)')
    expect(action).toContain('new Database(env.DB_DATABASE_PATH')
    expect(action).toContain('{ readonly: true }')
    expect(action).toContain('HIDDEN_FIELDS')
    expect(action).toContain('isSafeIdentifier')
    expect(action).toContain('unavailable.push')
    expect(action).toContain('has not been migrated')
    expect(action).toContain('Could not search model')
    expect(action).not.toContain('A single optional model must not make dashboard search unavailable')
    expect(action).not.toContain('Chris Breuer')
    expect(action).not.toContain('Premium Plan')
    expect(action).not.toContain('Getting Started with Stacks')
  })

  test('registers the search endpoint on the delegated dashboard API surface', () => {
    const apiRoutes = source('storage/framework/defaults/routes/dashboard-api.ts')
    const viewRoutes = source('storage/framework/defaults/routes/dashboard.ts')
    const client = source('storage/framework/defaults/functions/search.ts')

    expect(apiRoutes).toContain("guard(route.get('/search', 'Actions/Dashboard/Search/GlobalSearchAction'))")
    expect(viewRoutes).not.toContain("'Actions/Dashboard/Search/GlobalSearchAction'")
    expect(client).toContain('`${baseUrl}/dashboard/search?q=${encodeURIComponent(query)}`')
  })

  test('mounts a native command palette in the dashboard layout', () => {
    const component = source('storage/framework/defaults/resources/components/Dashboard/GlobalSearch.stx')
    const layout = source('storage/framework/defaults/views/dashboard/layouts/default.stx')

    expect(layout).toContain('<GlobalSearch />')
    expect(component).toContain('x-model="query"')
    expect(component).toContain("useEventListener('keydown', handleGlobalKeydown)")
    expect(component).toContain('navigate(item.href)')
    expect(component).toContain('unavailable().length')
    expect(component).toContain('role="dialog"')
    expect(component).toContain('aria-modal="true"')
    expect(component).not.toContain('<svg')
    expect(component).not.toContain('window.')
    expect(component).not.toContain('document.')
  })

  test('the generic model browser honors a search query from navigation', () => {
    const modelView = source('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordsDashboard.stx')

    expect(modelView).toContain("const search = state(navigation.urlQuery('q') || '')")
    expect(modelView).toContain('x-model="search"')
    expect(modelView).toContain('x-model.number="perPage"')
    expect(modelView).not.toContain(':value="search()"')
  })
})
