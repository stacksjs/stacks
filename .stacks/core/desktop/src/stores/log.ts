import { acceptHMRUpdate, defineStore } from 'pinia'

const perPage = 20

export const useLogStore = defineStore('log', {
  state: (): any => {
    return { logs: [], results: {} as any }
  },
  actions: {
    async fetchLogs(params: any): Promise<void> {
      const param = params || { page: 1 }

      const results = await search('change_logs', { filters: params.filters, query: param.search, page: param.page, perPage })

      this.setLogs(results.hits)
      this.setResults(results)
    },

    setLogs(logs: []): void {
      this.logs = logs
    },
    setResults(results: any): void {
      this.results = results
    },
  },
  getters: {
    hasLogs(state): number {
      return state.logs.length
    },

  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAgencyStore, import.meta.hot))
