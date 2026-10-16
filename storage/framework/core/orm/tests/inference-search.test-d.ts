// eslint-disable-next-line pickier/no-import-dist
import { defineModel } from '../dist/define-model'

const Searchable = defineModel({ name: 'SearchInference', table: 'search_inferences', traits: { useSearch: { searchable: ['name'], filterable: [], sortable: [], displayable: ['id'], index: 'custom_people' } }, attributes: { name: { type: 'string' } } } as const)
const Plain = defineModel({ name: 'PlainSearchInference', table: 'plain_search_inferences', traits: { useSearch: false }, attributes: { name: { type: 'string' } } } as const)
const hits: Promise<unknown[]> = Searchable.search('runner').where({ status: 'public' }).get()
const count: Promise<number> = Searchable.makeAllSearchable(500)
void hits
void count
// @ts-expect-error Search statics are not installed without the trait.
Plain.search('runner')
