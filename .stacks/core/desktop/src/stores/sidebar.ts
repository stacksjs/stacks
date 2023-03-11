import { acceptHMRUpdate, defineStore } from 'pinia'

export const useSidebarStore = defineStore('sidebar', {
  state: (): any => {
    return { mobileSidebar: false }
  },
  actions: {
    showSidebar() {
      this.mobileSidebar = true
    },
    closeSidebar() {
      this.mobileSidebar = false
    },
  },

})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAgencyStore, import.meta.hot))
