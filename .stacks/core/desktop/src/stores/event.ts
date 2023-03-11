import { acceptHMRUpdate, defineStore } from 'pinia'
import type { Event, EventRsvp, MeilisearchResults } from './../types'
import { useUserStore } from '~/stores/user'

const fetch = useHttpFetch()
const perPage = 20

export const useEventStore = defineStore('event', {
  state: (): any => {
    return {
      events: [] as Event[],
      eventRsvps: [] as EventRsvp[],
      upcomingEvents: [] as Event[],
      upcomingEventsCount: 0,
      event: {} as Event,
      results: {} as MeilisearchResults,
      filterableAttributes: [] as string[],
      facetDistribution: {} as any,
    }
  },
  actions: {
    async fetchEvents(params: any): Promise<void> {
      const param = params || { page: 1 }

      const offsetNum = param.page * perPage
      let offset = param.page === 1 ? 0 : offsetNum

      if (offsetNum > this.results.estimatedTotalHits)
        offset = this.results.estimatedTotalHits - perPage

      const results = await search('events', { filters: params.filters, sort: param?.sort, query: param.search, page: param.page, perPage, offset, facetDistribution: this.filterableAttributes })

      if (!params.search)
        this.setFacetDistribution(results.facetDistribution)

      this.setEvents(results.hits)

      this.setResults(results)
    },

    async fetchEventRsvps(eventId: number, params: any): Promise<void> {
      const param = params || { page: 1 }

      const offsetNum = param.page * perPage
      let offset = param.page === 1 ? 0 : offsetNum

      if (offsetNum > this.results.estimatedTotalHits)
        offset = this.results.estimatedTotalHits - perPage

      const filter = params.filters || []

      filter.push(`event_id=${eventId}`)

      const results = await search('event_rsvps', { filters: filter, sort: param?.sort, query: param.search, page: param.page, perPage, offset, facetDistribution: this.filterableAttributes })

      if (!params.filters && !params.search)
        this.setFacetDistribution(results.facetDistribution)

      this.setEventRsvps(results.hits)

      this.setResults(results)
    },

    async getFilterableAttributes(index: string) {
      const filterableAttributes = await getFilterableAttributes(index)

      this.setFilterableAttributes(filterableAttributes.filter(attribute => attribute !== 'date_start'))
    },

    async fetchUpcomingEvents(params: any): Promise<void> {
      const param = params || { page: 1 }

      const now = new Date()
      const timestampInMilliseconds = now.getTime()
      const timestamp = timestampInMilliseconds / 1000

      const filters = `date_start > ${timestamp}`

      const results = await search('events', { filters, sort: ['date_start:asc'], query: param.search, page: param.page, perPage: 5 })

      this.setUpcomingEvents(results.hits)
      this.setUpcomingEventsCount(results.estimatedTotalHits)

      this.setResults(results)
    },

    async fetchEvent(id: number): Promise<void> {
      const data = await fetch.get(`events/${id}`)

      this.setEvent(data)
    },

    async deleteEvent(id: number): Promise<void> {
      await fetch.destroy(`events/${id}`)
    },

    async createEvent(params: any): Promise<void> {
      await fetch.post('events', { body: params })
    },

    async updateEvent(id: number, params: any): Promise<void> {
      await fetch.patch(`events/${id}`, { body: params })
    },

    setEvents(events: Event[]): void {
      this.events = events
    },
    setEventRsvps(events: EventRsvp[]): void {
      this.eventRsvps = events
    },
    setUpcomingEvents(upcomingEvents: Event[]): void {
      this.upcomingEvents = upcomingEvents
    },
    setUpcomingEventsCount(eventsCount: number): void {
      this.upcomingEventsCount = eventsCount
    },
    setEvent(event: Event): void {
      this.event = event
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
    hasEvents(state): number {
      return state.events.length
    },
    hasEventRsvps(state): number {
      return state.eventRsvps.length
    },
    bearerToken(): string {
      const userStore = useUserStore()

      return userStore.token || window.localStorage.getItem('bearerToken')
    },
  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useEventStore, import.meta.hot))
