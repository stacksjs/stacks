import { acceptHMRUpdate, defineStore } from 'pinia'
import type { MeilisearchResults, Pagination, TeamMember, User } from '~/types'

const fetch = useHttpFetch()
const perPage = 20

export const useUserStore = defineStore('user', {
  state: (): any => {
    return {
      users: [] as User[],
      user: {} as User,
      userCount: 0,
      memberCount: 0,
      agentCount: 0,
      recruitCount: 0,
      teamMembers: [] as TeamMember[],
      teamMember: {} as TeamMember,
      pagination: {} as Pagination,
      results: {} as MeilisearchResults,
      filterableAttributes: [] as string[],
      facetDistribution: {} as any,
    }
  },
  actions: {
    async loginUser(user: any): Promise<void> {
      const data = await fetch.post('login', { body: user })

      this.setBearerToken(data.token)
    },

    async syncUser(id: number): Promise<void> {
      const data = await fetch.get(`users/sync-user/${id}`)

      this.setUser(data)
    },

    async fetchUsers(params: any): Promise<void> {
      const param = params || { page: 1 }

      const offsetNum = param.page * perPage
      let offset = param.page === 1 ? 0 : offsetNum

      if (offsetNum > this.results.estimatedTotalHits)
        offset = this.results.estimatedTotalHits - perPage

      const results = await search('users', { filters: param.filters, sort: param?.sort, query: param.search, page: param.page, perPage, offset, facetDistribution: this.filterableAttributes })

      if (!params.search)
        this.setFacetDistribution(results.facetDistribution)

      this.setUsers(results.hits)
      this.setResults(results)
    },

    async getFilterableAttributes(index: string) {
      const filterableAttributes = await getFilterableAttributes(index)

      this.setFilterableAttributes(filterableAttributes)
    },

    async fetchUser(id: number) {
      const data = await fetch.get(`users/${id}`)

      this.setUser(data)
    },
    async createUser(params: any) {
      const data = await fetch.post('users', { body: params })

      this.setUser(data)
    },
    async updateUser(id: number, params: any) {
      const data = await fetch.patch(`users/${id}`, { body: params })

      this.setUser(data)
    },
    async deleteUser(id: number) {
      await fetch.destroy(`users/${id}`)
    },
    async fetchUserCount() {
      const data = await fetch.get('users/count')

      this.setUserCount(data.count)
    },
    async fetchMemberCount() {
      const data = await fetch.get('users/members/count')

      this.setMemberCount(data.count)
    },
    async fetchAgentsCount() {
      const data = await fetch.get('users/agents/count')

      this.setAgentCount(data.count)
    },
    async fetchRecruitsCount() {
      const data = await fetch.get('users/recruits/count')

      this.setRecruitCount(data.count)
    },
    async fetchTeamMembers(params: any): Promise<void> {
      const param = params || { page: 1 }

      const offsetNum = param.page * perPage
      let offset = param.page === 1 ? 0 : offsetNum

      if (offsetNum > this.results.estimatedTotalHits)
        offset = this.results.estimatedTotalHits - perPage

      const results = await search('team_members', { filters: params.filters, sort: params?.sort, query: param.search, page: param.page, perPage, offset, facetDistribution: this.filterableAttributes })

      if (!params.filters && !params.search)
        this.setFacetDistribution(results.facetDistribution)

      this.setTeamMembers(results.hits)
      this.setResults(results)
    },

    async createTeamMember(params: any): Promise<void> {
      await fetch.post('team-members', { body: params })
    },

    async updateTeamMember(id: number, params: any): Promise<void> {
      await fetch.post(`team-members/${id}`, { body: params })
    },

    async deleteTeamMember(id: number): Promise<void> {
      await fetch.destroy(`team-members/${id}`)
    },

    async logout() {
      await fetch.post('logout')

      this.removeBearerToken()
    },

    async fetchTeamMember(id: number): Promise<void> {
      const data = await fetch.get(`team-members/${id}`)

      this.setTeamMember(data)
    },

    setBearerToken(token: string): void {
      fetch.setToken(token)
      window.localStorage.setItem('bearerToken', token)
    },

    removeBearerToken() {
      this.token = ''
      window.localStorage.removeItem('bearerToken')
    },

    setUsers(users: User[]): void {
      this.users = users
    },
    setFilterableAttributes(attributes: string[]): void {
      this.filterableAttributes = attributes
    },
    setFacetDistribution(facets: any): void {
      this.facetDistribution = facets
    },
    setUser(user: User): void {
      this.user = user
    },
    setUserCount(count: number): void {
      this.userCount = count
    },
    setMemberCount(count: number): void {
      this.memberCount = count
    },
    setAgentCount(count: number): void {
      this.agentCount = count
    },
    setRecruitCount(count: number): void {
      this.recruitCount = count
    },
    setTeamMembers(teamMembers: TeamMember[]): void {
      this.teamMembers = teamMembers
    },
    setTeamMember(teamMember: TeamMember): void {
      this.teamMember = teamMember
    },
    setPagination(pagination: Pagination): void {
      this.pagination = pagination
    },
    setResults(results: MeilisearchResults): void {
      this.results = results
    },
  },
  getters: {
    hasUsers(state): number {
      return state.users.length
    },
    hasTeamMembers(state): number {
      return state.teamMembers.length
    },

  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useUserStore, import.meta.hot))
