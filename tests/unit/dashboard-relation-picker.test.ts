import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The picker a `belongsTo` field is asked for with, and where a record's page
 * shows what it points at (stacksjs/stacks#3257). Driven in a browser against
 * real pages; these pin what that run relied on.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

const components = 'storage/framework/defaults/resources/components/Dashboard'
const picker = source(`${components}/Models/ModelRelationPicker.stx`)

describe('the relation picker', () => {
  test('both forms get it through the inputs they share', () => {
    const inputs = source(`${components}/Models/ModelFieldInputs.stx`)
    expect(inputs).toContain('<ModelRelationPicker')
    expect(inputs).toContain(':if="field.type === \'relation\'"')
    expect(inputs).toContain(':slug="field.relation ? field.relation.slug : \'\'"')
    // And not a number box as well.
    expect(inputs).toContain('&& field.type !== \'relation\'')
  })

  test('asks the light endpoint, not the model browser\'s', () => {
    const record = source('storage/framework/defaults/functions/dashboard-model-record.ts')
    expect(record).toContain('`${modelPath(slug)}/options${query ? `?${query}` : \'\'}`')
    expect(source('storage/framework/defaults/routes/dashboard-api.ts')).toContain('guard(route.get(\'/models/{slug}/options\', \'Actions/Dashboard/Models/ModelOptionsAction\'))')
  })

  test('holds the id in a field of the form\'s own name', () => {
    expect(picker).toContain('<input type="hidden" :name="name() || null" :value="value()">')
    expect(picker).toContain('emit(\'update:value\', String(option.id))')
    expect(picker).toContain('emit(\'update:value\', \'\')')
  })

  test('is a combobox a keyboard and a screen reader can use', () => {
    expect(picker).toContain('role="combobox"')
    expect(picker).toContain('aria-autocomplete="list"')
    expect(picker).toContain(':aria-expanded="open() ? \'true\' : \'false\'"')
    expect(picker).toContain('role="listbox"')
    expect(picker).toContain('role="option"')
    expect(picker).toContain(':aria-selected="index === active() ? \'true\' : \'false\'"')
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'])
      expect(picker).toContain(`event.key === '${key}'`)
  })

  test('Enter picks from the list and never submits the form', () => {
    const enter = picker.slice(picker.indexOf('event.key === \'Enter\''))
    expect(enter.slice(0, enter.indexOf('else if'))).toContain('event.preventDefault()')
  })

  test('an option keeps the search focused while it is pressed, so the press is not lost to the blur', () => {
    expect(picker).toContain('@mousedown.prevent="choose(option)"')
  })

  test('only the latest search may fill the list', () => {
    expect(picker).toContain('const mine = ++asked')
    expect(picker).toContain('if (mine !== asked)')
  })

  test('uses no article it could get wrong, and no browser global', () => {
    // "Search for an user" was what the vowel rule produced.
    expect(picker).not.toMatch(/\? 'an' : 'a'/)
    expect(picker).not.toMatch(/\b(?:document|window)\./)
  })
})

describe('a record\'s page', () => {
  const page = source(`${components}/Models/ModelRecordDetail.stx`)

  test('links to each record it points at, by name', () => {
    expect(page).toContain('<StxLink :if="detail.kind === \'link\'" :to="detail.href"')
    expect(page).toContain('modelRecordSections(record()!)')
  })

  test('has the names with the record, so it waits for nothing', () => {
    // They came from a request per relation; the record now carries them (stacksjs/stacks#3259).
    expect(page).not.toContain('fetchModelRelationNames')
  })
})
