import { acceptHMRUpdate, defineStore } from 'pinia'
import type { MeilisearchResults, Pagination, Webpage, WebpageLead } from '~/types'

const perPage = 20
const fetch = useHttpFetch()

export const useWebpageStore = defineStore('webpage', {
  state: (): any => {
    return {
      webpages: [] as Webpage[],
      webpageLeads: [] as WebpageLead[],
      webpage: {} as WebpageLead,
      webpageCount: 0,
      leadCount: 0,
      headerImages: [] as string[],
      pagination: {} as Pagination,
      results: {} as MeilisearchResults,
      filterableAttributes: [] as string[],
      facetDistribution: {} as any,
      formErrors: {} as any,
      webpageForm: {
        first_name: '',
        last_name: '',
        subdomain: '',
        email_address: '',
        phone: '',
        state: '',
        city: '',
        postal_code: '',
        carecompare_purl: '',
        copyblock_1: 1,
        copyblock_2: 1,
        headline_1_image: '',
        headline_1: 1,
        profile_picture: '' as File | string,
        secondary_logo: '' as File | string,
        status: '',
      },
    }
  },
  actions: {
    async fetchWebpages(params: any): Promise<void> {
      const param = params || { page: 1 }

      const offsetNum = param.page * perPage
      let offset = param.page === 1 ? 0 : offsetNum

      if (offsetNum > this.results.estimatedTotalHits)
        offset = this.results.estimatedTotalHits - perPage

      const results = await search('webpages', { filters: params.filters, sort: param?.sort, query: param.search, page: param.page, perPage, offset, facetDistribution: this.filterableAttributes })

      this.setResults(results)

      this.setWebpages(results.hits)

      if (!params.search)
        this.setFacetDistribution(results.facetDistribution)
    },
    async getFilterableAttributes(index: string) {
      const filterableAttributes = await getFilterableAttributes(index)

      this.setFilterableAttributes(filterableAttributes)
    },
    async fetchWebpage(id: number): Promise<void> {
      const data = await fetch.get(`webpages/${id}`)

      this.setWebpage(data)
    },
    async fetchWebpageCard(id: number): Promise<void> {
      const data = await fetch.get(`webpages/${id}`)

      this.setWebpage(data.data)
    },
    async fetchWebpageLeads(id: number, params: any): Promise<void> {
      const param = params || { page: 1 }

      const data = await fetch.get(`webpages/${id}/leads`, { params: { page: param.page, search: param.search } })

      this.setWebpageLeads(data.data)
      this.setPagination(data.meta)
    },
    async fetchLeadsCount() {
      const data = await fetch.get('webpages/leads/acount')

      this.setWebpagesCount(data.count)
    },
    async fetchWebpagesCount() {
      const data = await fetch.get('webpages/count')

      this.setAgentCount(data.count)
    },

    async fetchWebpageHeaderImages(): Promise<void> {
      const data = await fetch.get('webpages/images')

      this.setHeaderImages(data)
    },
    async fetchWebpageCount(): Promise<void> {
      const data = await fetch.get('webpages/count')

      this.setWebpageCount(data.count)
    },

    async fetchLeadCount(): Promise<void> {
      const data = await fetch.get('webpages/leads/count')

      this.setWebpageLeadsCount(data.count)
    },

    async deleteWebpage(id: number): Promise<void> {
      await fetch.destroy(`webpages/${id}`)
    },

    async deactivateWebpage(id: number): Promise<void> {
      await fetch.post(`webpages/deactivate/${id}`)
    },

    async updateWebpageStatus(id: number, status: string): Promise<void> {
      const data = await fetch.patch(`webpages/${id}/status`, { body: { status } })

      this.setWebpage(data.data)
    },

    async updateWebpage(id: number, params: any): Promise<void> {
      const data = await fetch.post(`webpages/${id}`, { body: params })

      this.setWebpage(data)
    },

    async updateWebpageChanges(id: number, params: any): Promise<void> {
      await fetch.post(`webpages/changes/${id}`, { body: params })
    },

    async sendWebpageChat(id: number, params: any): Promise<void> {
      const data = await fetch.post(`/webpages/chat/${id}`, { body: params })

      this.setWebpage(data)
    },

    setWebpages(webpages: Webpage[]): void {
      this.webpages = webpages
    },
    setFormErrors(formErrors: any): void {
      this.formErrors = formErrors
    },
    setWebpageLeads(webpageLeads: WebpageLead[]): void {
      this.webpageLeads = webpageLeads
    },
    setWebpage(webpage: Webpage): void {
      this.webpage = webpage
    },
    setWebpageCount(count: number): void {
      this.webpageCount = count
    },
    setWebpageLeadsCount(count: number): void {
      this.leadCount = count
    },
    setHeaderImages(images: string[]): void {
      this.headerImages = images
    },
    setPagination(pagination: Pagination): void {
      this.pagination = pagination
    },
    setFilterableAttributes(attributes: string[]): void {
      this.filterableAttributes = attributes
    },
    setFacetDistribution(facets: any): void {
      this.facetDistribution = facets
    },
    setResults(results: MeilisearchResults): void {
      this.results = results
    },
  },
  getters: {
    hasWebpages(state): number {
      return state.webpages.length
    },
    hasWebpageLeads(state): number {
      return state.webpageLeads.length
    },

  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useWebpageStore, import.meta.hot))
