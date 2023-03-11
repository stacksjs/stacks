import { acceptHMRUpdate, defineStore } from 'pinia'
import { useUserStore } from '~/stores/user'
import type { Agency, MeilisearchResults } from '~/types'

const fetch = useHttpFetch()
const perPage = 20

export const useAgencyStore = defineStore('agency', {
  state: (): any => {
    return {
      agencies: [] as Agency[],
      agency: {} as Agency,
      results: {} as MeilisearchResults,
    }
  },
  actions: {
    async fetchAgencies(params: any): Promise<void> {
      const param = params || { page: 1 }

      const offsetNum = param.page * perPage
      let offset = param.page === 1 ? 0 : offsetNum

      if (offsetNum > this.results.estimatedTotalHits)
        offset = this.results.estimatedTotalHits - perPage

      const results = await search('agencies', { query: param.search, sort: param?.sort, page: param.page, perPage, offset })

      this.setAgencies(results.hits)

      this.setResults(results)
    },

    async fetchAgency(id: number): Promise<void> {
      const data = await fetch.get(`agencies/${id}`)

      this.setAgency(data)
    },

    async createAgency(params: any): Promise<void> {
      const data = await fetch.post('agencies', { body: params })

      this.setAgency(data)
    },

    async updateAgency(id: number, params: any): Promise<void> {
      const data = await fetch.patch(`agencies/${id}`, { body: params })

      this.setAgency(data)
    },

    async deleteAgency(id: number): Promise<void> {
      await fetch.destroy(`agencies/${id}`)
    },

    setAgencies(agencies: Agency[]): void {
      this.agencies = agencies
    },
    setResults(results: MeilisearchResults): void {
      this.results = results
    },
    setAgency(agency: Agency): void {
      this.agency = agency
    },

  },
  getters: {
    hasAgencies(state): number {
      return state.agencies.length
    },
    bearerToken(): string {
      const userStore = useUserStore()

      return userStore.token || window.localStorage.getItem('bearerToken')
    },
  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAgencyStore, import.meta.hot))
