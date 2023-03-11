import { defineStore } from 'pinia'

export const useFilter = defineStore('filter', {
  state: () => {
    return {
      filterRules: {} as any,
      filterVal: [] as any[],
      filterKey: '',
      sortVal: '',
      search: '',
      sort: [] as string[],
      sortType: {} as any,
    }
  },
  actions: {
    setFilterRules(filters: any[]): void {
      this.filterRules[this.filterKey] = filters
    },

    setFilterVal(filterVal: any[]): void {
      this.filterVal = filterVal
    },

    setFilterKey(key: string): void {
      this.filterKey = key
    },
    setSort(sort: string[]) {
      this.sort = sort
    },
    setSearch(search: string) {
      this.search = search
    },
    setSortVal(sortVal: string) {
      this.sortVal = sortVal
    },
    setSortType(col: string, sortType: string) {
      this.sortType[col] = sortType
    },
    clearFilters() {
      this.filterRules = {}
    },
    resetFilters() {
      this.filterRules = {}
      this.filterVal = []
      this.filterKey = ''
      this.sortVal = ''
      this.search = ''
      this.sort = []
      this.sortType = {}
    },
  },
  getters: {
    currentFilterRules(state: any): any {
      return state.filterRules
    },
    currentFilterKey(state: any): string {
      return state.filterKey
    },
  },
})
