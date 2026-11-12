import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Where a record's page shows who points at it (stacksjs/stacks#3258), and
 * the two places a panel leads: the related model's list narrowed to this
 * record, and its create form with this record chosen. Driven in a browser
 * against real pages; these pin what that run relied on.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

const components = 'storage/framework/defaults/resources/components/Dashboard'
const panels = source(`${components}/Models/ModelRelatedPanels.stx`)

describe('a record\'s page', () => {
  const page = source(`${components}/Models/ModelRecordDetail.stx`)

  test('shows its panels below its own fields, when it has any', () => {
    expect(page).toContain('<ModelRelatedPanels')
    // Not hidden while the record is read again: the panels stay where they are.
    expect(page).toContain(':if="record() && related().length > 0"')
    expect(page).toContain(':from="selfHref()"')
  })

  test('does not wait for them, and is still the record\'s page without them', () => {
    expect(page).toContain('void fetchModelRelated(slug(), recordId()).then(panels => related.set(panels)).catch(() => related.set([]))')
  })

  test('asks the endpoint that reads the model\'s own hasMany and hasOne', () => {
    expect(source('storage/framework/defaults/routes/dashboard-api.ts')).toContain('guard(route.get(\'/models/{slug}/{id}/related\', \'Actions/Dashboard/Models/ModelRelatedAction\'))')
    expect(source('storage/framework/defaults/functions/dashboard-model-record.ts')).toContain('`${modelPath(slug)}/${encodeURIComponent(String(id))}/related`')
  })
})

describe('a panel', () => {
  test('is drawn with the dashboard\'s own table, inside its card', () => {
    expect(panels).toContain('<Table')
    expect(panels).toContain(':framed="false"')
    expect(panels).toContain('@row-action="act(panel, $event)"')
  })

  test('names its eye for the record it opens, not the record that row is called by', () => {
    // The buttons are named in one place, with the pencil and the trash the
    // related model allows (stacksjs/stacks#3270).
    expect(panels).toContain('return modelRelatedRowActions(panel)')
    expect(source('storage/framework/defaults/functions/dashboard-model-record.ts')).toContain('{ action: \'view\', label: `View ${one}` },')
  })

  test('says nothing beside its heading when it is empty, and how many it is showing when there are more', () => {
    expect(panels).toContain('if (panel.kind === \'one\' || panel.total === 0)')
    expect(panels).toContain('`Newest ${panel.rows.length} of ${panel.total}`')
  })

  test('offers "View all" only where there is a list to see, and "Add" only where one can be added', () => {
    expect(panels).toContain(':if="panel.kind === \'many\' && panel.total > 0"')
    expect(panels).toContain(':if="canAdd(panel)"')
    // A second of a hasOne would break the "one".
    expect(panels).toContain('return panel.canCreate && (panel.kind === \'many\' || panel.total === 0)')
  })
})

describe('where a panel leads', () => {
  test('the list it opens arrives narrowed, with the filter in view to clear', () => {
    const browser = source(`${components}/Models/ModelRecordsDashboard.stx`)
    expect(browser).toContain('state<Record<string, string>>(modelListFilters(navigation.urlQuery(\'filters\')))')
    expect(browser).toContain('const showFilters = state(Object.keys(filters()).length > 0)')
  })

  test('the form it opens starts with this record chosen', () => {
    const create = source(`${components}/Models/ModelRecordCreate.stx`)
    expect(create).toContain('values.set({ ...modelFormValues(loaded.fields), ...modelFormPrefill(loaded.fields, name => navigation.urlQuery(name)) })')
  })
})
