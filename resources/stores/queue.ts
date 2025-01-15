interface Queue {
  id?: number
  queue: string
  payload: string
  attempts?: number
  available_at?: number
  reserved_at?: Date | null
  created_at: string
  updated_at?: string | null
}

interface State {
  queues: Queue[]
}

export const useQueueStore = defineStore('queue', {
  state: (): State => {
    return {
      queues: [],
    }
  },

  actions: {
    async fetchQueues(): Promise<void> {
      const url = `http://localhost:3008/queues`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      const queues = await response.json() as Queue[]
      
      this.queues = queues
    },
  },

  getters: {
    getQueues: state => state.queues
  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useQueueStore, import.meta.hot))
