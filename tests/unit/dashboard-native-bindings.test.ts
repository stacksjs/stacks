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
})
