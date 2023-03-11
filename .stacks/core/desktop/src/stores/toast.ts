import { defineStore } from 'pinia'

export const useToastStore = defineStore('toast', {
  state: () => {
    return { type: '', title: '', show: false, position: 'top-right', duration: 2000 }
  },
  actions: {
    setTitle(title: string): void {
      this.title = title
    },
    setType(type: string): void {
      this.type = type
    },
    setPosition(position: string): void {
      this.position = position
    },
    setDuration(duration: number): void {
      this.duration = duration
    },
    toggleToast(status: boolean) {
      this.show = status
    },
  },
  getters: {

  },
})
