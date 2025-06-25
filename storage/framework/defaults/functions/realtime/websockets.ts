import type { StoreWebsocket, Websockets } from '../../types/defaults'
import { useFetch, useStorage } from '@vueuse/core'

const baseURL = 'http://localhost:3008'

// Create a persistent websockets array using VueUse's useStorage
const websockets = useStorage<Websockets[]>('websockets', [])

// Basic fetch function to get all websocket events
async function fetchWebsockets() {
  const { error, data } = await useFetch(`${baseURL}/realtime/websockets`).get().json()

  const websocketsJson = data.value as Websockets[]
  if (error.value) {
    console.error('Error fetching websocket events:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    websockets.value = websocketsJson
    return data.value
  }
  else {
    console.error('Expected array of websocket events but received:', typeof data.value)
    return []
  }
}

async function createWebsocket(websocket: Partial<StoreWebsocket>): Promise<Websockets | null> {
  const { error, data } = await useFetch(`${baseURL}/realtime/websockets`)
    .post(JSON.stringify(websocket))
    .json()

  if (error.value) {
    console.error('Error creating websocket event:', error.value)
    return null
  }

  const newWebsocket = data.value as Websockets
  if (newWebsocket) {
    websockets.value.unshift(newWebsocket)
    return newWebsocket
  }
  return null
}

async function updateWebsocket(id: number, websocket: Partial<Websockets>) {
  const { error, data } = await useFetch(`${baseURL}/realtime/websockets/${id}`)
    .patch(JSON.stringify(websocket))
    .json()

  if (error.value) {
    console.error('Error updating websocket event:', error.value)
    return null
  }

  const updatedWebsocket = data.value as Websockets
  if (updatedWebsocket) {
    const index = websockets.value.findIndex(w => w.id === id)
    if (index !== -1) {
      websockets.value[index] = updatedWebsocket
    }
    return updatedWebsocket
  }
  return null
}

async function deleteWebsocket(id: number) {
  const { error } = await useFetch(`${baseURL}/realtime/websockets/${id}`)
    .delete()
    .json()

  if (error.value) {
    console.error('Error deleting websocket event:', error.value)
    return false
  }

  const index = websockets.value.findIndex(w => w.id === id)
  if (index !== -1) {
    websockets.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useWebsockets() {
  return {
    websockets,
    fetchWebsockets,
    createWebsocket,
    updateWebsocket,
    deleteWebsocket,
  }
}
