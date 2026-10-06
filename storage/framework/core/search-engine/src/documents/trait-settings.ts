import type { SearchOptions } from '@stacksjs/types'
import type { Settings } from 'meilisearch'
import { snakeCase } from '@stacksjs/strings'

/**
 * The index settings a model's `useSearch` trait declares, and only those.
 *
 * Every list used to be sent, with `[]` standing in for one the model did not
 * declare. To Meilisearch an empty list is not "unset": `displayedAttributes:
 * []` returns every hit with no fields, and `searchableAttributes: []` makes
 * nothing searchable. So a model declaring only `searchable` imported cleanly
 * and then came back as empty objects, and one declaring only `filterable`
 * matched no query at all. An undeclared list is now left out, so the engine
 * keeps its default (every attribute) for it.
 */
export function settingsFromSearchTrait(
  useSearch: Partial<Pick<SearchOptions, 'searchable' | 'filterable' | 'sortable' | 'displayable'>>,
  options: { displayed?: boolean } = {},
): Settings {
  const settings: Settings = {}
  const declared = (list: string[] | undefined) => (Array.isArray(list) ? list.map(attr => snakeCase(attr)) : undefined)

  const searchable = declared(useSearch.searchable)
  const filterable = declared(useSearch.filterable)
  const sortable = declared(useSearch.sortable)
  const displayed = options.displayed === false ? undefined : declared(useSearch.displayable)

  if (searchable) settings.searchableAttributes = searchable
  if (filterable) settings.filterableAttributes = filterable
  if (sortable) settings.sortableAttributes = sortable
  if (displayed) settings.displayedAttributes = displayed

  return settings
}
