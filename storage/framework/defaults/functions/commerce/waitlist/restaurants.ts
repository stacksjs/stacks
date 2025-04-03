import type { WaitlistRestaurant } from '../../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent waitlist restaurants array using VueUse's useStorage
const waitlistRestaurants = useStorage<WaitlistRestaurant[]>('waitlist_restaurants', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all waitlist restaurants
async function fetchWaitlistRestaurants() {
  const { error, data } = useFetch<WaitlistRestaurant[]>(`${baseURL}/commerce/waitlist/restaurants`)

  if (error.value) {
    console.error('Error fetching waitlist restaurants:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    waitlistRestaurants.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of waitlist restaurants but received:', typeof data.value)
    return []
  }
}

async function createWaitlistRestaurant(waitlistRestaurant: WaitlistRestaurant) {
  const { error, data } = useFetch<WaitlistRestaurant>(`${baseURL}/commerce/waitlist/restaurants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(waitlistRestaurant),
  })

  if (error.value) {
    console.error('Error creating waitlist restaurant:', error.value)
    return null
  }

  if (data.value) {
    waitlistRestaurants.value.push(data.value)
    return data.value
  }
  return null
}

async function updateWaitlistRestaurant(waitlistRestaurant: WaitlistRestaurant) {
  const { error, data } = useFetch<WaitlistRestaurant>(`${baseURL}/commerce/waitlist/restaurants/${waitlistRestaurant.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(waitlistRestaurant),
  })

  if (error.value) {
    console.error('Error updating waitlist restaurant:', error.value)
    return null
  }

  if (data.value) {
    const index = waitlistRestaurants.value.findIndex(wr => wr.id === waitlistRestaurant.id)
    if (index !== -1) {
      waitlistRestaurants.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteWaitlistRestaurant(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/waitlist/restaurants/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting waitlist restaurant:', error.value)
    return false
  }

  const index = waitlistRestaurants.value.findIndex(wr => wr.id === id)
  if (index !== -1) {
    waitlistRestaurants.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useWaitlistRestaurants() {
  return {
    waitlistRestaurants,
    fetchWaitlistRestaurants,
    createWaitlistRestaurant,
    updateWaitlistRestaurant,
    deleteWaitlistRestaurant,
  }
}
