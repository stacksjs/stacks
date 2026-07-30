import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dashboardComponents = resolve(
  'storage/framework/defaults/resources/components/Dashboard',
)

function componentSource(path: string): string {
  return readFileSync(resolve(dashboardComponents, path), 'utf8')
}

describe('dashboard native STX bindings', () => {
  test('shared pagination models its local selection and emits the selected value', () => {
    const source = componentSource('Pagination.stx')

    expect(source).toContain('x-model.number="selectedItemsPerPage"')
    expect(source).toContain('emitItemsPerPage($event)')
    expect(source).not.toContain(':value="itemsPerPage()"')
  })

  test('analytics page header models its local selection across the component boundary', () => {
    const source = componentSource('Analytics/AnalyticsPageHeader.stx')

    expect(source).toContain('x-model="selectedRange"')
    expect(source).toContain('emitRange($event)')
    expect(source).not.toContain(':value="range()"')
  })

  test('event analytics form uses native models and submit prevention', () => {
    const source = componentSource('Analytics/EventAnalytics.stx')

    for (const model of [
      'eventName',
      'eventCategory',
      'eventPath',
      'eventValue',
      'eventCurrency',
    ])
      expect(source).toContain(`x-model="${model}"`)

    expect(source).toContain('@submit.prevent="submitEvent"')
    expect(source).not.toContain('function updateField(')
    expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
  })

  test('content dashboards use native filters and form models', () => {
    for (const component of [
      'Content/AuthorsDashboard.stx',
      'Content/CommentsDashboard.stx',
      'Content/ContentTaxonomyDashboard.stx',
      'Content/PagesDashboard.stx',
    ]) {
      const source = componentSource(component)
      expect(source).toContain('x-model=')
      expect(source).not.toMatch(/:value="[^"]+\(\)"[^>]+@(?:input|change)=/)
      expect(source).not.toMatch(/:checked="[^"]+\(\)"[^>]+@change=/)
      expect(source).not.toMatch(/function update[A-Z]\w*\(event: Event\)/)
    }

    const taxonomy = componentSource('Content/ContentTaxonomyDashboard.stx')
    expect(taxonomy).toContain(".normalize('NFKD')")
    expect(taxonomy).toContain('@input="markSlugTouched"')
    expect(taxonomy).toContain('@blur="normalizeSlug"')
  })
})
