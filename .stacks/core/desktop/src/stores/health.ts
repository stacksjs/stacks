import { defineStore } from 'pinia'
import { ofetch } from 'ofetch'
import type { Downtime, Uptime, UptimeWeek } from './../types'

import { useUserStore } from '~/stores/user'

const baseURL = import.meta.env.VITE_API_BASE_URL

export const useHealthStore = defineStore('health', {

  state: () => {
    return {
      activeTab: '',
      uptime: {} as Uptime,
      downtime: [] as Downtime[],
      uptimeWeek: [] as UptimeWeek[],
      uptimeYear: [] as UptimeWeek[],
      performanceRecords: [],
      siteChecks: {},
      certificate: {},
      brokenLinks: [],
      mixedContent: [],
      dns: {},
    }
  },
  actions: {
    setActiveTab(tab: string): void {
      this.activeTab = tab
    },
    async fetchUptime(): Promise<void> {
      const data = await ofetch('/health/uptime', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })

      this.setUptime(data)
    },
    async fetchUptimeWeek(): Promise<void> {
      const data = await ofetch('/health/uptime-week', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })
      this.setUptimeWeek(data)
    },
    async fetchUptimeYear(): Promise<void> {
      const data = await ofetch('/health/uptime-year', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })

      this.setUptimeYear(data)
    },
    async fetchDowntime(): Promise<void> {
      const data = await ofetch('/health/downtime', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })

      this.setDowntime(data)
    },

    async fetchCertificate(): Promise<void> {
      const data = await ofetch('/health/certificate', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })

      this.setCertificate(data)
    },
    async fetchPerformanceRecords(params: any): Promise<void> {
      const data = await ofetch('/health/performance-record', {
        method: 'GET',
        query: params,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })

      this.setPerformanceRecords(data)
    },

    async fetchBrokenLinks(): Promise<void> {
      const data = await ofetch('/health/broken-links', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })

      this.setBrokenLinks(data)
    },

    async fetchMixedContent(): Promise<void> {
      const data = await ofetch('/health/mixed-content', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })

      this.setMixedContent(data)
    },

    async fetchSiteChecks(): Promise<void> {
      const data = await ofetch('/health/site-checks', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })

      this.setSiteChecks(data)
    },

    async fetchDnsHistoryItems(): Promise<void> {
      const data = await ofetch('/health/dns-history-items', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        parseResponse: JSON.parse,
        baseURL,
      })

      this.setDnsHistory(data)
    },

    setUptime(uptime: Uptime): void {
      this.uptime = uptime
    },
    setUptimeWeek(uptimeWeek: UptimeWeek[]): void {
      this.uptimeWeek = uptimeWeek
    },
    setUptimeYear(uptimeYear: UptimeWeek[]): void {
      this.uptimeYear = uptimeYear
    },
    setDowntime(downtime: Downtime[]): void {
      this.downtime = downtime
    },
    setCertificate(certificate: any): void {
      this.certificate = certificate
    },
    setBrokenLinks(brokenLinks: []): void {
      this.brokenLinks = brokenLinks
    },
    setPerformanceRecords(performanceRecords: []): void {
      this.performanceRecords = performanceRecords
    },
    setMixedContent(mixedContent: []): void {
      this.mixedContent = mixedContent
    },
    setSiteChecks(siteChecks: {}): void {
      this.siteChecks = siteChecks
    },
    setDnsHistory(dns: any): void {
      this.dns = dns[0]
    },
  },
  getters: {
    currentTab(state): string {
      return state.activeTab
    },
    bearerToken(): string {
      const userStore = useUserStore()

      return userStore.token || window.localStorage.getItem('bearerToken')
    },
  },
})
