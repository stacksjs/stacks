import { acceptHMRUpdate, defineStore } from 'pinia'
import type { MeilisearchResults, Page } from '~/types'

const perPage = 20

export const usePageStore = defineStore('page', {
  state: (): any => {
    return { pages: [] as Page[], results: {} as MeilisearchResults }
  },
  actions: {
    async fetchPages(params: any): Promise<void> {
      const param = params || { page: 1 }

      const offsetNum = param.page * perPage
      let offset = param.page === 1 ? 0 : offsetNum

      if (offsetNum > this.results.estimatedTotalHits)
        offset = this.results.estimatedTotalHits - perPage

      const results = await search('pages', { filters: params.filters, sort: param?.sort, query: param.search, page: param.page, perPage, offset })

      this.setPages(results.hits)

      this.setResults(results)
    },

    setPages(pages: Page[]): void {
      this.pages = pages
    },

    setResults(results: MeilisearchResults): void {
      this.results = results
    },
  },
  getters: {
    hasPages(state): number {
      return state.pages.length
    },

  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useEventStore, import.meta.hot))
