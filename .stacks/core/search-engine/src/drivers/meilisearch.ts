// import { defineSearchEngineDriver } from '@stacksjs/drivers'
// import { MeiliSearch } from '@stacksjs/search-engine'
// import { MeiliSearchOptions } from '@stacksjs/types'
// import { MeiliSearch, calculatePagination, currentPage, filterName, filters, goToNextPage, goToPage, goToPrevPage, hits, index, lastPage, perPage, query, results, search, searchFilters, searchParams, setTotalHits, sort, sorts, totalPages } from '@stacksjs/search-engine'
// import { computed } from 'vue'

// function determineState() {
//   const ls = localStorage.getItem('table')

//   if (isString(ls))
//     return JSON.parse(ls)

//   // initial default state - overwrite with properties passed down from parent component
//   const searchEngine = {
//     source: '',
//     password: '',
//     type: '',
//     index: '',
//     columns: [],
//     filters: [],
//     perPage: 20,
//     currentPage: 1,
//     query: '',
//   }

//   return searchEngine
// }

// const searchEngine = (useStorage('search-engine', determineState()).value)

// function calculatePagination() {
//   totalPages.value = Math.ceil(totalHits / table.perPage)

//   const hitPages = [...Array(totalPages.value).keys()].map(i => i + 1)
//   const offset = 2
//   const currentPage = table.currentPage
//   const lastPage = hitPages[hitPages.length - 1]

//   let from = currentPage - offset
//   if (from < 1)
//     from = 1

//   let to = from + offset * 2
//   if (to >= lastPage)
//     to = lastPage

//   const allPages = []
//   for (let page = from; page <= to; page++)
//     allPages.push(page)

//   pages.value = allPages
// }

// export default function defineDriver(opts: MeiliSearchOptions) {
//   const client = new MeiliSearch({ host: opts.host, apiKey: opts.apiKey })

//   return defineSearchEngineDriver({
//     client,
//     index: (name: string) => client.index(name),
//     search: async (index: string, params: any) => {
//       return await client
//         .index(index)
//         .search(params.query, { limit: params.perPage, offset: params.page * params.perPage })
//     },
//     createIndex: async (name: string) => {
//       return await client.createIndex(name)
//     },
//     deleteIndex: async (name: string) => {
//       return await client.deleteIndex(name)
//     },
//     getIndex: async (name: string) => {
//       return await client.getIndex(name)
//     },
//     updateIndexSettings: async (name: string, settings: any) => {
//       return await client.index(name).updateSettings(settings)
//     },
//     listAllIndexes: async () => {
//       return await client.getIndexes()
//     },
//     calculatePagination: (params: any) => {
//       return {}
//     },
//     currentPage: (params: any) => {
//       return 1
//     }
//   },
// })
