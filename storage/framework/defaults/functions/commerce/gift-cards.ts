import type { GiftCards } from '../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent gift cards array using VueUse's useStorage
const giftCards = useStorage<GiftCards[]>('giftCards', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all gift cards
async function fetchGiftCards(): Promise<GiftCards[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/gift-cards`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as GiftCards[]

    if (Array.isArray(data)) {
      giftCards.value = data
      return data
    }
    else {
      console.error('Expected array of gift cards but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching gift cards:', error)
    return []
  }
}

async function createGiftCard(giftCard: GiftCards): Promise<GiftCards | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/gift-cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(giftCard),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as GiftCards
    if (data) {
      giftCards.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating gift card:', error)
    return null
  }
}

async function updateGiftCard(giftCard: GiftCards): Promise<GiftCards | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/gift-cards/${giftCard.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(giftCard),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as GiftCards
    if (data) {
      const index = giftCards.value.findIndex(g => g.id === giftCard.id)
      if (index !== -1) {
        giftCards.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating gift card:', error)
    return null
  }
}

async function deleteGiftCard(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/commerce/gift-cards/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = giftCards.value.findIndex(g => g.id === id)
    if (index !== -1) {
      giftCards.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting gift card:', error)
    return false
  }
}

// Export the composable
export function useGiftCards() {
  return {
    giftCards,
    fetchGiftCards,
    createGiftCard,
    updateGiftCard,
    deleteGiftCard,
  }
}
