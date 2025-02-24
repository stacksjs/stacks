import type { Ref } from 'vue'
import { ref } from 'vue'

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

export const useQueueStore = defineStore('queue', () => {
  const queues: Ref<Queue[]> = ref([])

  async function fetchQueues(): Promise<void> {
    const url = `http://localhost:3008/queues`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    const res = await response.json() as Queue[]

    queues.value = res
  }

  return {
    queues,
    fetchQueues,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useQueueStore, import.meta.hot))
