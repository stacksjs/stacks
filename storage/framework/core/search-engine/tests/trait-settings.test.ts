import { describe, expect, test } from 'bun:test'
import { settingsFromSearchTrait } from '../src/documents/trait-settings'

/**
 * The settings sync sent every list, with `[]` for the ones a model did not
 * declare. To Meilisearch `[]` is a value, not "unset": `displayedAttributes:
 * []` returns hits with no fields and `searchableAttributes: []` makes nothing
 * searchable. An undeclared list is now left out, so the engine keeps its
 * default of every attribute.
 */
describe('settingsFromSearchTrait', () => {
  test('a model declaring only searchable does not hide every field', () => {
    expect(settingsFromSearchTrait({ searchable: ['name', 'shortDescription'] })).toEqual({
      searchableAttributes: ['name', 'short_description'],
    })
  })

  test('a model declaring only filterable does not make nothing searchable', () => {
    const settings = settingsFromSearchTrait({ filterable: ['status'] })

    expect(settings).toEqual({ filterableAttributes: ['status'] })
    expect('searchableAttributes' in settings).toBe(false)
  })

  test('declared lists are all sent, snake-cased', () => {
    expect(settingsFromSearchTrait({
      searchable: ['name'],
      filterable: ['categoryId'],
      sortable: ['createdAt'],
      displayable: ['id', 'name'],
    })).toEqual({
      searchableAttributes: ['name'],
      filterableAttributes: ['category_id'],
      sortableAttributes: ['created_at'],
      displayedAttributes: ['id', 'name'],
    })
  })

  test('an explicitly empty list is still a declaration', () => {
    expect(settingsFromSearchTrait({ sortable: [] })).toEqual({ sortableAttributes: [] })
  })

  test('the settings command can leave displayed attributes to the import', () => {
    expect(settingsFromSearchTrait({ searchable: ['name'], displayable: ['id'] }, { displayed: false })).toEqual({
      searchableAttributes: ['name'],
    })
  })
})
