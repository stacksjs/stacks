<script setup lang="ts">
// import { isString } from '@stacksjs/validation'

// import type { Hits, SearchResponse } from '@stacksjs/types'

// interface Props {
//   type: string // the Meilisearch index you would like to use for this table
//   columns: string | string[] // used as table heads/column titles
//   source?: string // optional: the Meilisearch host name/address (defaults: http://127.0.0.1:7700)
//   password?: string // optional: the Meilisearch password (defaults: '')
//   searchable?: string | boolean // optional: determines whether the table displays the search bar (defaults: true)
//   query?: string // optional: the "query" (= search input) used to search the table (defaults: '')
//   sortable?: string | boolean // optional: determines whether the table displays the "table head"-sorts (defaults: true)
//   sort?: string // optional: the only active sort to be applied to the table (defaults: '')
//   sorts?: string | string[] // optional: the specific type of sorts to be applied to the table (defaults: [])
//   filterable?: string | boolean // optional: determines whether the table displays the filters component (defaults: true)
//   filters?: string | string[] // optional: the specific type of filters to be displayed/utilized in the table (defaults: [])
//   actionable?: string | boolean // optional: determines whether the table displays any "action items" (defaults: true)
//   actions?: string | string[] // optional: the specific type of actions to be displayed/utilized in the table (defaults: 'Edit, Delete')
//   perPage?: string | number // optional: the number of rows (items) to be displayed per page (defaults: 10)
//   currentPage?: number // optional: the current page number (defaults: 1)
//   selectable?: string | boolean // optional: determines whether the table displays the checkboxes (defaults: true)
//   selectedRows?: number[] | string[] // optional: holds the selected rows (defaults: [])
//   selectedAll?: boolean // optional: determines whether all the rows are selected (defaults: false)
//   results?: SearchResponse<Record<string, any>> // optional: the Meilisearch search response (defaults: {})
//   hits?: Hits // optional: the Meilisearch hits (we could also name this "rows" as that would be more applicable to the "table domain" but choosing to stay in sync with Meilisearch right now until we implement for a second search engine driver)
//   // stickyHeader?: string | boolean // optional: holds the selected rows (defaults: [])
//   // stickyFooter?: string | boolean // optional: determines whether all the rows are selected (defaults: false)
// }

// const {
//   type,
//   columns,
//   source = 'http://127.0.0.1:7700',
//   password = '',
//   searchable = true,
//   query = '',
//   sortable = true,
//   sort = '',
//   sorts = [],
//   filterable = true,
//   filters = [],
//   actionable = false,
//   actions = ['Edit', 'Delete'],
//   perPage = 20,
//   selectable = true,
//   selectedRows = [],
//   selectedAll = false,
// } = defineProps<Props>()

// const parsedColumns = computed((): string[] => {
//   if (isString(columns))
//     return columns.split(',').map(col => col.trim())

//   return columns
// })

// const parsedSorts = computed((): string[] => {
//   if (isString(sorts))
//     return sorts.split(',').map(col => col.trim())

//   return sorts
// })
// const parsedFilters = computed((): string[] => {
//   if (isString(filters))
//     return filters.split(',').map(col => col.trim())

//   return filters
// })
// const itemsPerPage = computed((): number => {
//   if (isString(perPage))
//     return parseInt(perPage)

//   return perPage
// })

// // let's use (init) the table by passing the default state
// const { table, search, columnName } = await useTable({
//   source,
//   password,
//   type,
//   columns: parsedColumns.value,
//   searchable,
//   query,
//   sortable,
//   sort,
//   sorts: parsedSorts.value,
//   filterable,
//   filters: parsedFilters.value,
//   actionable,
//   actions,
//   perPage: itemsPerPage.value,
//   currentPage: 1,
//   selectable: true,
//   selectedRows: [],
//   selectedAll: false,
// })

// // let's run the initial search upon page view/load

// // console.log('running initial search')
// const results = await search()
// // eslint-disable-next-line no-console
// console.log('initial search complete', results)

// // now that we have the search results, let's update/set the state of the table
// table.source = source
// table.password = password
// table.hits = results?.hits
// table.type = type
// table.columns = parsedColumns.value
// table.searchable = searchable
// table.query = query
// table.filterable = filterable
// table.filters = parsedFilters.value
// table.sortable = sortable
// table.sort = sort
// table.sorts = parsedSorts.value
// table.perPage = itemsPerPage.value
// table.actionable = actionable
// table.actions = actions
// table.selectable = selectable
// table.selectedRows = selectedRows
// table.selectedAll = selectedAll
// table.results = results as SearchResponse
</script>

<template>
  table test
</template>
