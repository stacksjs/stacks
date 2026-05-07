import type { WaitlistRestaurant } from '../../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../../toasts'

// Create a persistent waitlist restaurants array using VueUse's useStorage
const waitlistRestaurants = useStorage<WaitlistRestaurant[]>('waitlist_restaurants', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

// Basic fetch function to get all waitlist restaurants
async function fetchWaitlistRestaurants() {
  try {
    const response = await fetch(`${baseURL}/commerce/waitlist/restaurants`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as WaitlistRestaurant[]

    if (Array.isArray(data)) {
      waitlistRestaurants.value = data
      return data
    }
    else {
      pushToast('error', 'Couldn\'t load waitlist restaurants', { detail: 'Server returned a non-array response' })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Error fetching waitlist restaurants', { detail: String(error) })
    return []
  }
}

async function createWaitlistRestaurant(waitlistRestaurant: WaitlistRestaurant) {
  try {
    const response = await fetch(`${baseURL}/commerce/waitlist/restaurants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waitlistRestaurant),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as WaitlistRestaurant
    if (data) {
      waitlistRestaurants.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error creating waitlist restaurant', { detail: String(error) })
    return null
  }
}

async function updateWaitlistRestaurant(waitlistRestaurant: WaitlistRestaurant) {
  try {
    const response = await fetch(`${baseURL}/commerce/waitlist/restaurants/${waitlistRestaurant.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waitlistRestaurant),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as WaitlistRestaurant
    if (data) {
      const index = waitlistRestaurants.value.findIndex(wr => wr.id === waitlistRestaurant.id)
      if (index !== -1) {
        waitlistRestaurants.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error updating waitlist restaurant', { detail: String(error) })
    return null
  }
}

async function deleteWaitlistRestaurant(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/waitlist/restaurants/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = waitlistRestaurants.value.findIndex(wr => wr.id === id)
    if (index !== -1) {
      waitlistRestaurants.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    pushToast('error', 'Error deleting waitlist restaurant', { detail: String(error) })
    return false
  }
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
